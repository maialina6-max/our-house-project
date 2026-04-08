# DOCUMENTS.md — Document Management Skill

## Purpose
Handle document upload, local file storage, server-side AI analysis with PDF text extraction,
automatic payment_request creation, per-document Q&A, and structured metadata used in the main chat.

## Storage — Local SQLite + Disk

Files are stored on the local filesystem at `data/documents/`.
Metadata is stored in the `documents` table in `data/bayit.db` (SQLite).

No cloud service. No Supabase. Everything runs on the user's machine.

### documents table schema
```sql
CREATE TABLE IF NOT EXISTS documents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name   TEXT NOT NULL,
  file_path   TEXT NOT NULL,      -- filename inside data/documents/
  file_type   TEXT NOT NULL DEFAULT 'application/octet-stream',
  uploaded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  category    TEXT NOT NULL DEFAULT 'אחר',
  ai_summary          TEXT,
  ai_extracted_amount REAL,
  ai_extracted_payee  TEXT,
  ai_extracted_date   TEXT,
  status      TEXT NOT NULL DEFAULT 'processed',  -- 'processed' | 'analyzed'
  file_hash   TEXT UNIQUE,          -- SHA-256 for duplicate detection
  ai_parties          TEXT,         -- JSON array: [{ role, name }]
  ai_important_dates  TEXT,         -- JSON array: [{ label, date }]
  ai_obligations      TEXT,         -- JSON array: [string]
  ai_lawyer_questions TEXT          -- JSON array: [string]
);
```

Migrations add new columns to existing installs via `ALTER TABLE … ADD COLUMN`.
All four `ai_*` JSON columns are stored as TEXT and parsed back to arrays by `parseDocRow()` before being returned from any API endpoint.

## Filename Handling (Windows UTF-8 fix)

Files on disk use a **UUID filename** — never the original Hebrew name.
- **On disk (`file_path`)**: `{uuid}{ext}` — safe on all filesystems
- **In DB (`file_name`)**: original Hebrew name, re-decoded from latin1 multipart bytes

## Upload + Analysis Flow

1. User selects/drops file → `apiUploadDocument(file)` → POST /api/documents/upload
2. multer saves to `data/documents/{uuid}.{ext}`
3. Server computes SHA-256 hash → checks for duplicate
   - Duplicate: delete temp file, return `409 { duplicate: true, existing_document }`
   - Not duplicate: insert row with `file_hash`, return document record
4. React: if `result.duplicate` → show amber warning banner (5 s); else `onAdd(doc)`
5. If API key set → `apiAnalyzeDocument(doc.id, apiKey)` → POST /api/documents/:id/analyze
6. Server extracts content (PDF text or image base64), calls Claude, parses rich JSON
7. Server updates document row with all rich fields, inserts `payment_requests` row if needed
8. React updates document in state, auto-expands analysis panel, adds payment_request if returned

## Document Categories
- היתר בנייה / חוזה / קבלה / שמאות / מסמך רשמי / דרישת תשלום / אחר

## AI Analysis Endpoint

`POST /api/documents/:id/analyze`
- Header: `x-api-key: <claude api key>`
- Returns: `{ document, payment_request }` (payment_request is null if none found)
- document object has all rich fields parsed to arrays (not raw JSON strings)

### Prompt (rich extraction)
Claude returns JSON only:
```json
{
  "category": "...",
  "summary": "2-3 sentences in Hebrew",
  "parties": [{ "role": "מוכר/קונה/רשות/עורך דין/אחר", "name": "..." }],
  "important_dates": [{ "label": "...", "date": "YYYY-MM-DD or null" }],
  "obligations": ["single sentence in Hebrew"],
  "lawyer_questions": ["single sentence in Hebrew"],
  "has_payment_request": true/false,
  "payment_request": {
    "description", "payee", "amount_before_vat", "vat_required",
    "vat_included", "vat_amount", "amount_total", "due_date"
  }
}
```

## Per-Document Q&A Endpoint (Phase 2)

`POST /api/documents/:id/ask`
- Body: `{ question: string, apiKey: string }`
- Loads document from disk, extracts content (same as analyze)
- Calls Claude with system prompt: answer only from this document, in Hebrew, cite the section
- Returns: `{ answer: string }`

UI: "💬 שאל" button on each analyzed document card → inline `DocChat` component.
History is session-only (React state, not persisted to DB). Multiple Q&A turns supported.

## Document List Display
Each card shows:
- File icon, name, upload date
- "מנתח..." while analysis in progress, "✓ נותח" when done
- "▼ פרטי ניתוח" button → expandable `AnalysisPanel` with:
  - Summary, parties grid, important dates, obligations, lawyer questions
  - Auto-expands after first successful analysis
- "💬 שאל" button → inline `DocChat` component
- Category select (inline)
- Delete button

## Chat System Prompt (Phase 3)

`buildSystemPrompt(expenses, documents)` in `src/utils/buildSystemPrompt.js` now accepts a `documents` array and includes a structured "=== מסמכים שהועלו ===" section in the Claude system prompt with: name, category, summary, parties, important dates, obligations.

This gives the main chat both structured metadata (from the system prompt) and raw file content (sent as document/image blocks), for the most accurate answers.

## PDF Text Extraction

Uses `pdf-parse` v2 (class-based API):
```js
import { PDFParse } from 'pdf-parse'
const parser = new PDFParse({ data: fileBuffer })
const parsed = await parser.getText()
const text = parsed.text
```
Do NOT use `pdfParse(buffer)` (v1 API) or import from `pdf-parse/lib/pdf-parse.js`.

## Duplicate Detection
- SHA-256 of raw file bytes, stored in `file_hash TEXT UNIQUE`
- Partial unique index: `WHERE file_hash IS NOT NULL` (nulls from old rows don't conflict)
- Content-based — renaming still triggers duplicate warning

## Delete Flow
1. "מחק" → `handleDelete(id)` awaits `onDelete(id)`
2. Server: DELETE related `payment_requests` (CASCADE) → DELETE document row → `fs.unlinkSync` file
3. Returns `{ success: true }`; UI removes item only after server confirms

## Error Handling
- Upload failed: inline error "ההעלאה נכשלה, נסו שוב"
- Duplicate: amber banner (auto-dismiss 5 s)
- Delete failed: inline error, item stays in list
- Analysis failed: document saved normally, silently skipped
- No API key: hint shown; analysis + ask buttons hidden

## How to Extend
- Re-analysis button: call POST /api/documents/:id/analyze again
- PDF preview: render from `/api/documents/:id/content`
- Persist Q&A history to a `document_questions` table
