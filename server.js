import express from 'express'
import cors from 'cors'
import multer from 'multer'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

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
    status      TEXT NOT NULL DEFAULT 'processed'
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
`)

// ── Multer ─────────────────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DOCS_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
})
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } })

// ── Documents ──────────────────────────────────────────────────────────────────

app.get('/api/documents', (req, res) => {
  res.json(db.prepare('SELECT * FROM documents ORDER BY uploaded_at DESC').all())
})

app.post('/api/documents/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'קובץ לא נמצא' })
  const { originalname, filename, mimetype } = req.file
  const result = db.prepare(
    'INSERT INTO documents (file_name, file_path, file_type) VALUES (?, ?, ?)'
  ).run(originalname, filename, mimetype)
  res.json(db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid))
})

app.put('/api/documents/:id', (req, res) => {
  const fields = req.body
  const keys = Object.keys(fields)
  if (keys.length === 0) return res.status(400).json({ error: 'אין שדות לעדכון' })
  const set = keys.map((k) => `${k} = ?`).join(', ')
  db.prepare(`UPDATE documents SET ${set} WHERE id = ?`).run(...keys.map((k) => fields[k]), req.params.id)
  res.json(db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id))
})

app.delete('/api/documents/:id', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id)
  if (!doc) return res.status(404).json({ error: 'מסמך לא נמצא' })
  const filePath = path.join(DOCS_DIR, doc.file_path)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// Serves the raw file so the React app can read it and send to Claude API
app.get('/api/documents/:id/content', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id)
  if (!doc) return res.status(404).json({ error: 'מסמך לא נמצא' })
  const filePath = path.join(DOCS_DIR, doc.file_path)
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'קובץ לא נמצא בדיסק' })
  res.setHeader('Content-Type', doc.file_type)
  res.sendFile(filePath)
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
