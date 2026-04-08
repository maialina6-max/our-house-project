import express from 'express'
import cors from 'cors'
import multer from 'multer'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import { PDFParse } from 'pdf-parse'
import OpenAI from 'openai'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const DOCS_DIR = path.join(DATA_DIR, 'documents')
const DB_PATH = path.join(DATA_DIR, 'bayit.db')

fs.mkdirSync(DOCS_DIR, { recursive: true })

const app = express()
app.use(cors())
app.use(express.json())

// ── Database ──────────────────────────────────────────────────────────────────

const db = new Database(DB_PATH)
db.pragma('encoding = "UTF-8"')

db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name   TEXT NOT NULL,
    file_path   TEXT NOT NULL,
    file_type   TEXT NOT NULL DEFAULT 'application/octet-stream',
    uploaded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    category    TEXT NOT NULL DEFAULT 'אחר',
    ai_summary          TEXT,
    ai_extracted_amount REAL,
    ai_extracted_payee  TEXT,
    ai_extracted_date   TEXT,
    status      TEXT NOT NULL DEFAULT 'processed',
    file_hash   TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    amount      REAL NOT NULL,
    category    TEXT NOT NULL DEFAULT 'אחר',
    date        TEXT NOT NULL,
    notes       TEXT,
    source_document_id INTEGER REFERENCES documents(id),
    status      TEXT NOT NULL DEFAULT 'confirmed',
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS payment_requests (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    source_document_id  INTEGER REFERENCES documents(id),
    description         TEXT,
    payee               TEXT,
    amount_before_vat   REAL,
    vat_required        INTEGER DEFAULT 0,
    vat_included        INTEGER DEFAULT 0,
    vat_amount          REAL,
    amount_total        REAL,
    due_date            TEXT,
    status              TEXT DEFAULT 'pending',
    paid_at             TEXT,
    created_at          TEXT DEFAULT (datetime('now'))
  );
`)

// Migrations — add columns that didn't exist in earlier schema versions.
// Uses db.prepare().run() (single-statement path) so errors are catchable per statement.
const migrations = [
  'ALTER TABLE expenses ADD COLUMN source_payment_request_id INTEGER REFERENCES payment_requests(id)',
  'ALTER TABLE expenses ADD COLUMN amount_before_vat REAL',
  'ALTER TABLE expenses ADD COLUMN vat_amount REAL',
  'ALTER TABLE documents ADD COLUMN file_hash TEXT',
  'ALTER TABLE documents ADD COLUMN ai_parties TEXT',
  'ALTER TABLE documents ADD COLUMN ai_important_dates TEXT',
  'ALTER TABLE documents ADD COLUMN ai_obligations TEXT',
  'ALTER TABLE documents ADD COLUMN ai_lawyer_questions TEXT',
]
for (const sql of migrations) {
  try { db.prepare(sql).run() } catch { /* column already exists */ }
}
// Unique index on file_hash (WHERE NOT NULL so existing null rows don't conflict)
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_file_hash ON documents(file_hash) WHERE file_hash IS NOT NULL')

// ── Multer ─────────────────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DOCS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ''
    cb(null, `${uuidv4()}${ext}`)
  },
})
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } })

// ── OpenAI helper ─────────────────────────────────────────────────────────────

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Call OpenAI chat completions. apiKey overrides the env default per-request.
async function callOpenAI(apiKey, messages, maxTokens = 1024) {
  const client = apiKey ? new OpenAI({ apiKey }) : openai
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: maxTokens,
    messages,
  })
  return completion.choices[0].message.content ?? ''
}

const ANALYSIS_PROMPT = `אתה מנתח מסמכים הקשורים לרכישת קרקע ובנייה במושב בישראל.
נתח את המסמך והחזר JSON בלבד, ללא הסברים, בפורמט הבא:

{
  "category": "one of: היתר בנייה / חוזה / קבלה / שמאות / מסמך רשמי / דרישת תשלום / אחר",
  "summary": "תיאור קצר של 2-3 משפטים בעברית",
  "parties": [
    { "role": "מוכר / קונה / רשות / עורך דין / אחר", "name": "שם הצד" }
  ],
  "important_dates": [
    { "label": "תיאור התאריך בעברית", "date": "YYYY-MM-DD or null" }
  ],
  "obligations": [
    "התחייבות או תנאי חשוב — משפט אחד בעברית"
  ],
  "lawyer_questions": [
    "שאלה שכדאי לשאול את עורך הדין — משפט אחד בעברית"
  ],
  "has_payment_request": true or false,
  "payment_request": {
    "description": "תיאור מה התשלום עבור, בעברית",
    "payee": "למי לשלם, בעברית",
    "amount_before_vat": number or null,
    "vat_required": true or false,
    "vat_included": true or false,
    "vat_amount": number or null,
    "amount_total": number or null,
    "due_date": "YYYY-MM-DD or null"
  }
}

חוקי חישוב מע"מ:
- אם vat_required=true ו-vat_included=true: amount_before_vat = amount_total / 1.17, vat_amount = amount_total - amount_before_vat
- אם vat_required=true ו-vat_included=false: vat_amount = amount_before_vat * 0.17, amount_total = amount_before_vat + vat_amount
- אם vat_required=false: amount_total = amount_before_vat, vat_amount = 0

החזר JSON בלבד.`

// Parse JSON array columns back to JS arrays when reading document rows from SQLite
function parseDocRow(row) {
  if (!row) return null
  return {
    ...row,
    ai_parties: row.ai_parties ? JSON.parse(row.ai_parties) : [],
    ai_important_dates: row.ai_important_dates ? JSON.parse(row.ai_important_dates) : [],
    ai_obligations: row.ai_obligations ? JSON.parse(row.ai_obligations) : [],
    ai_lawyer_questions: row.ai_lawyer_questions ? JSON.parse(row.ai_lawyer_questions) : [],
  }
}

// ── Documents ──────────────────────────────────────────────────────────────────

app.get('/api/documents', (req, res) => {
  res.json(db.prepare('SELECT * FROM documents ORDER BY uploaded_at DESC').all().map(parseDocRow))
})

app.post('/api/documents/upload', upload.single('file'), (req, res) => {
  try {
    console.log('[upload] Request received')
    if (!req.file) {
      console.log('[upload] No file in request')
      return res.status(400).json({ error: 'קובץ לא נמצא' })
    }

    const { filename, mimetype } = req.file
    console.log(`[upload] File received: ${filename} (${mimetype})`)

    // On Windows, multer reads the multipart content-disposition filename as latin1 bytes
    // even though the browser sends UTF-8. Re-decode it so Hebrew names appear correctly.
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8')
    const savedPath = path.join(DOCS_DIR, filename)

    console.log('[upload] Computing hash...')
    const fileBuffer = fs.readFileSync(savedPath)
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex')
    console.log(`[upload] Hash: ${hash.slice(0, 16)}...`)

    console.log('[upload] Checking duplicate...')
    const existing = db.prepare(
      'SELECT file_name, uploaded_at, category FROM documents WHERE file_hash = ?'
    ).get(hash)
    if (existing) {
      console.log(`[upload] Duplicate found: "${existing.file_name}"`)
      fs.unlinkSync(savedPath)
      return res.status(409).json({
        duplicate: true,
        existing_document: {
          file_name: existing.file_name,
          uploaded_at: existing.uploaded_at,
          category: existing.category,
        },
      })
    }

    console.log('[upload] Saving to database...')
    const result = db.prepare(
      'INSERT INTO documents (file_name, file_path, file_type, file_hash) VALUES (?, ?, ?, ?)'
    ).run(originalName, filename, mimetype, hash)
    const doc = parseDocRow(db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid))
    console.log(`[upload] Saved document id=${doc.id} "${doc.file_name}"`)
    res.json(doc)
  } catch (err) {
    console.error('[upload] ERROR:', err)
    res.status(500).json({ error: err.message || 'שגיאה בהעלאה' })
  }
})

app.post('/api/documents/:id/analyze', async (req, res) => {
  const apiKey = req.headers['x-api-key']
  console.log('[analyze] API key received:', apiKey ? apiKey.slice(0, 10) + '...' : 'MISSING')
  if (!apiKey) return res.status(400).json({ error: 'מפתח API חסר' })

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id)
  if (!doc) return res.status(404).json({ error: 'מסמך לא נמצא' })

  const filePath = path.join(DOCS_DIR, doc.file_path)
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'קובץ לא נמצא בדיסק' })

  try {
    let messages
    if (doc.file_type === 'application/pdf') {
      const fileBuffer = fs.readFileSync(filePath)
      const parser = new PDFParse({ data: fileBuffer })
      const parsed = await parser.getText()
      const pdfText = parsed.text || ''
      messages = [{ role: 'user', content: `${ANALYSIS_PROMPT}\n\nתוכן המסמך (PDF):\n${pdfText}` }]
    } else if (doc.file_type.startsWith('image/')) {
      const base64 = fs.readFileSync(filePath).toString('base64')
      messages = [{
        role: 'user',
        content: [
          { type: 'text', text: ANALYSIS_PROMPT },
          { type: 'image_url', image_url: { url: `data:${doc.file_type};base64,${base64}` } },
        ],
      }]
    } else {
      return res.status(400).json({ error: 'סוג קובץ לא נתמך לניתוח' })
    }

    const rawText = await callOpenAI(apiKey, messages)

    // Extract JSON from response (strip markdown code fences if present)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('תגובת AI לא תקינה')
    const analysis = JSON.parse(jsonMatch[0])

    console.log(`[analyze] doc=${doc.id} category="${analysis.category}" summary_len=${(analysis.summary||'').length}`)
    console.log(`[analyze] parties=${JSON.stringify(analysis.parties || [])}`)
    console.log(`[analyze] important_dates=${JSON.stringify(analysis.important_dates || [])}`)
    console.log(`[analyze] obligations=${JSON.stringify(analysis.obligations || [])}`)
    console.log(`[analyze] lawyer_questions=${JSON.stringify(analysis.lawyer_questions || [])}`)
    console.log(`[analyze] has_payment_request=${analysis.has_payment_request}`)

    // Update document with AI results (all rich fields)
    const rawUpdated = db.prepare(`
      UPDATE documents
      SET category = ?, ai_summary = ?, status = ?,
          ai_parties = ?, ai_important_dates = ?,
          ai_obligations = ?, ai_lawyer_questions = ?
      WHERE id = ? RETURNING *
    `).get(
      analysis.category || 'אחר',
      analysis.summary || null,
      'analyzed',
      JSON.stringify(analysis.parties || []),
      JSON.stringify(analysis.important_dates || []),
      JSON.stringify(analysis.obligations || []),
      JSON.stringify(analysis.lawyer_questions || []),
      doc.id,
    )
    console.log(`[analyze] saved to DB: ai_parties="${rawUpdated.ai_parties}" ai_obligations="${rawUpdated.ai_obligations}"`)
    const updatedDoc = parseDocRow(rawUpdated)

    // Create payment_request row if needed
    let paymentRequest = null
    if (analysis.has_payment_request && analysis.payment_request) {
      const pr = analysis.payment_request
      const prResult = db.prepare(`
        INSERT INTO payment_requests
          (source_document_id, description, payee, amount_before_vat, vat_required,
           vat_included, vat_amount, amount_total, due_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        doc.id,
        pr.description || null,
        pr.payee || null,
        pr.amount_before_vat || null,
        pr.vat_required ? 1 : 0,
        pr.vat_included ? 1 : 0,
        pr.vat_amount || null,
        pr.amount_total || null,
        pr.due_date || null,
      )
      paymentRequest = db.prepare('SELECT * FROM payment_requests WHERE id = ?').get(prResult.lastInsertRowid)
    }

    res.json({ document: updatedDoc, payment_request: paymentRequest })
  } catch (err) {
    console.error('AI analysis error:', err)
    res.status(500).json({ error: err.message || 'שגיאה בניתוח AI' })
  }
})

app.post('/api/documents/:id/ask', async (req, res) => {
  const { question, apiKey } = req.body
  if (!question) return res.status(400).json({ error: 'שאלה חסרה' })
  if (!apiKey) return res.status(400).json({ error: 'מפתח API חסר' })

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id)
  if (!doc) return res.status(404).json({ error: 'מסמך לא נמצא' })

  const filePath = path.join(DOCS_DIR, doc.file_path)
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'קובץ לא נמצא בדיסק' })

  try {
    const SYSTEM = 'אתה מנתח מסמך בודד מפרויקט רכישת קרקע ובנייה במושב בישראל. ענה רק על פי המסמך המצורף. ענה בעברית. היה ספציפי וציין את החלק הרלוונטי במסמך.'
    let messages
    if (doc.file_type === 'application/pdf') {
      const fileBuffer = fs.readFileSync(filePath)
      const parser = new PDFParse({ data: fileBuffer })
      const parsed = await parser.getText()
      messages = [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `תוכן המסמך (PDF):\n${parsed.text || ''}\n\nשאלה: ${question}` },
      ]
    } else if (doc.file_type.startsWith('image/')) {
      const base64 = fs.readFileSync(filePath).toString('base64')
      messages = [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:${doc.file_type};base64,${base64}` } },
          { type: 'text', text: `שאלה: ${question}` },
        ]},
      ]
    } else {
      return res.status(400).json({ error: 'סוג קובץ לא נתמך' })
    }

    const answer = await callOpenAI(apiKey, messages)
    res.json({ answer })
  } catch (err) {
    console.error('Document ask error:', err)
    res.status(500).json({ error: err.message || 'שגיאה בשאלה' })
  }
})

// ── Chat ──────────────────────────────────────────────────────────────────────

app.post('/api/chat', async (req, res) => {
  const { messages: history, systemPrompt, documents: docIds, apiKey } = req.body
  if (!apiKey) return res.status(400).json({ error: 'מפתח API חסר' })

  try {
    // Build OpenAI messages: system + conversation history + current turn with doc content
    const oaiMessages = [{ role: 'system', content: systemPrompt || '' }]

    // Prior turns (all but last)
    for (const m of history.slice(0, -1)) {
      oaiMessages.push({ role: m.role, content: m.content })
    }

    // Current user turn — inline document content
    const lastText = history[history.length - 1].content
    const userParts = []

    for (const docId of (docIds || [])) {
      const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId)
      if (!doc) continue
      const filePath = path.join(DOCS_DIR, doc.file_path)
      if (!fs.existsSync(filePath)) continue
      try {
        if (doc.file_type === 'application/pdf') {
          const parser = new PDFParse({ data: fs.readFileSync(filePath) })
          const parsed = await parser.getText()
          userParts.push({ type: 'text', text: `=== ${doc.file_name} ===\n${parsed.text || ''}` })
        } else if (doc.file_type.startsWith('image/')) {
          const base64 = fs.readFileSync(filePath).toString('base64')
          userParts.push({ type: 'image_url', image_url: { url: `data:${doc.file_type};base64,${base64}` } })
        }
      } catch { /* skip unreadable doc */ }
    }

    userParts.push({ type: 'text', text: lastText })
    oaiMessages.push({ role: 'user', content: userParts })

    const answer = await callOpenAI(apiKey, oaiMessages, 4096)
    res.json({ answer })
  } catch (err) {
    console.error('Chat error:', err)
    res.status(500).json({ error: err.message || 'שגיאה בצ׳אט' })
  }
})

app.put('/api/documents/:id', (req, res) => {
  const fields = req.body
  const keys = Object.keys(fields)
  if (keys.length === 0) return res.status(400).json({ error: 'אין שדות לעדכון' })
  const set = keys.map((k) => `${k} = ?`).join(', ')
  db.prepare(`UPDATE documents SET ${set} WHERE id = ?`).run(...keys.map((k) => fields[k]), req.params.id)
  res.json(parseDocRow(db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id)))
})

app.delete('/api/documents/:id', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id)
  if (!doc) return res.status(404).json({ error: 'מסמך לא נמצא' })
  // CASCADE: remove related payment_requests before removing the document
  db.prepare('DELETE FROM payment_requests WHERE source_document_id = ?').run(req.params.id)
  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id)
  const filePath = path.join(DOCS_DIR, doc.file_path)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  res.json({ success: true })
})

app.get('/api/documents/:id/content', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id)
  if (!doc) return res.status(404).json({ error: 'מסמך לא נמצא' })
  const filePath = path.join(DOCS_DIR, doc.file_path)
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'קובץ לא נמצא בדיסק' })
  res.setHeader('Content-Type', doc.file_type)
  res.sendFile(filePath)
})

// ── Payment Requests ───────────────────────────────────────────────────────────

app.get('/api/payment-requests', (req, res) => {
  res.json(db.prepare('SELECT * FROM payment_requests ORDER BY created_at DESC').all())
})

app.post('/api/payment-requests/:id/pay', (req, res) => {
  const { paid_at } = req.body
  if (!paid_at) return res.status(400).json({ error: 'תאריך תשלום חסר' })

  const pr = db.prepare('SELECT * FROM payment_requests WHERE id = ?').get(req.params.id)
  if (!pr) return res.status(404).json({ error: 'דרישת תשלום לא נמצאה' })

  // Get document category for the expense
  let category = 'אחר'
  if (pr.source_document_id) {
    const doc = db.prepare('SELECT category FROM documents WHERE id = ?').get(pr.source_document_id)
    if (doc) category = doc.category
  }

  // Mark payment request as paid
  db.prepare("UPDATE payment_requests SET status = 'paid', paid_at = ? WHERE id = ?")
    .run(paid_at, pr.id)

  // Auto-create expense
  const expResult = db.prepare(`
    INSERT INTO expenses
      (description, amount, category, date, source_document_id,
       source_payment_request_id, amount_before_vat, vat_amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    pr.description,
    pr.amount_total,
    category,
    paid_at,
    pr.source_document_id || null,
    pr.id,
    pr.amount_before_vat || null,
    pr.vat_amount || null,
  )

  const updatedPr = db.prepare('SELECT * FROM payment_requests WHERE id = ?').get(pr.id)
  const newExpense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(expResult.lastInsertRowid)

  res.json({ payment_request: updatedPr, expense: newExpense })
})

// ── Expenses ───────────────────────────────────────────────────────────────────

app.get('/api/expenses', (req, res) => {
  res.json(db.prepare('SELECT * FROM expenses ORDER BY date DESC, created_at DESC').all())
})

app.post('/api/expenses', (req, res) => {
  const { description, amount, category, date, notes, source_document_id } = req.body
  if (!description || amount == null || !date) {
    return res.status(400).json({ error: 'שדות חובה חסרים' })
  }
  const result = db.prepare(
    'INSERT INTO expenses (description, amount, category, date, notes, source_document_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(description, amount, category || 'אחר', date, notes || null, source_document_id || null)
  res.json(db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid))
})

app.put('/api/expenses/:id', (req, res) => {
  const fields = req.body
  const keys = Object.keys(fields)
  if (keys.length === 0) return res.status(400).json({ error: 'אין שדות לעדכון' })
  const set = keys.map((k) => `${k} = ?`).join(', ')
  db.prepare(`UPDATE expenses SET ${set} WHERE id = ?`).run(...keys.map((k) => fields[k]), req.params.id)
  res.json(db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id))
})

app.delete('/api/expenses/:id', (req, res) => {
  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── Start ──────────────────────────────────────────────────────────────────────

app.listen(3001, () => console.log('Bayit BaMoshav server running at http://localhost:3001'))
