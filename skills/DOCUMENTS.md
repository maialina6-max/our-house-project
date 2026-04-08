# DOCUMENTS.md — Document Management Skill

## Purpose
Handle document upload, local file storage, server-side AI analysis with PDF text extraction,
and automatic payment_request creation from document analysis results.

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
  file_hash   TEXT UNIQUE   -- SHA-256 hex of file contents, for duplicate detection
);
-- Migration adds file_hash to existing installs:
-- ALTER TABLE documents ADD COLUMN file_hash TEXT
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_file_hash ON documents(file_hash) WHERE file_hash IS NOT NULL
```

## Filename Handling (Windows UTF-8 fix)

Files on disk use a **UUID filename** (`{uuid}.pdf`, `{uuid}.jpg`, etc.) — never the original Hebrew name.
The original Hebrew name is stored in `file_name` in the database and displayed in the UI.

Why two names:
- **On disk (`file_path`)**: `{uuid}{ext}` — safe on all filesystems, no encoding issues
- **In DB (`file_name`)**: original Hebrew name, properly decoded from the multipart header

Windows encoding fix: multer reads the multipart `content-disposition` filename as latin1 bytes even when the browser sends UTF-8. The server re-decodes it:
```js
Buffer.from(req.file.originalname, 'latin1').toString('utf8')
```

## Upload + Analysis Flow

Step 1 — User selects or drags a file (PDF or image) in Documents.jsx
Step 2 — React calls `apiUploadDocument(file)` → POST /api/documents/upload
Step 3 — multer saves file to data/documents/{uuid}.{ext}
Step 4 — Server computes SHA-256 hash of the saved file buffer
Step 5 — Server checks `documents WHERE file_hash = ?`
  - If match found: delete the temp file from disk, return HTTP 409 `{ duplicate: true, existing_document: { file_name, uploaded_at, category } }`
  - If no match: continue
Step 6 — Server decodes original Hebrew filename, inserts row with file_hash, returns document record
Step 7 — React: if `result.duplicate`, shows amber warning banner (auto-dismisses after 5 s); skips `onAdd`
Step 8 — React adds doc to state via `onAdd(doc)` (only for non-duplicates)
Step 6 — If API key is set, React calls `apiAnalyzeDocument(doc.id, apiKey)` → POST /api/documents/:id/analyze
Step 7 — Server extracts content:
  - PDF: uses `pdf-parse` to extract raw text → sent as text to Claude
  - Image: read as base64 → sent as image block to Claude
Step 8 — Server calls Claude API with extracted content + structured prompt
Step 9 — Claude returns JSON: category, summary, has_payment_request, payment_request
Step 10 — Server updates documents row (category, ai_summary, status='analyzed')
Step 11 — If has_payment_request=true, server inserts row into payment_requests table
Step 12 — Endpoint returns { document, payment_request }
Step 13 — React updates document in state; if payment_request returned, adds to paymentRequests state

## Document Categories
Always classify into one of:
- היתר בנייה
- חוזה
- קבלה
- שמאות
- מסמך רשמי
- דרישת תשלום
- אחר

## AI Analysis Endpoint

`POST /api/documents/:id/analyze`
- Header: `x-api-key: <claude api key>`
- No request body needed
- Returns: `{ document, payment_request }` (payment_request is null if none found)

## AI Extraction Prompt

The server sends this prompt + document content to Claude (claude-sonnet-4-20250514):

```
Respond ONLY with valid JSON:
{
  "category": "one of: היתר בנייה / חוזה / קבלה / שמאות / מסמך רשמי / דרישת תשלום / אחר",
  "summary": "2-3 sentence summary in Hebrew",
  "has_payment_request": true or false,
  "payment_request": {
    "description": "what the payment is for, in Hebrew",
    "payee": "who to pay, in Hebrew",
    "amount_before_vat": number or null,
    "vat_required": true or false,
    "vat_included": true or false,
    "vat_amount": number or null,
    "amount_total": number or null,
    "due_date": "YYYY-MM-DD or null"
  }
}
```

VAT calculation rules (server enforces these):
- vat_required=true, vat_included=true: amount_before_vat = amount_total / 1.17
- vat_required=true, vat_included=false: vat_amount = amount_before_vat * 0.17, amount_total = amount_before_vat + vat_amount
- vat_required=false: amount_total = amount_before_vat, vat_amount = 0

## PDF Text Extraction

Uses the `pdf-parse` package (server-side). Loaded via:
```js
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
```
(Direct import path required to avoid ESM issues with the package's test runner)

The raw text is embedded in the prompt as plain text — Claude reads Hebrew accurately this way.

## Document List Display
Each document shows:
- File icon (📕 PDF, 🖼️ image, 📎 other)
- File name
- Upload date
- "מנתח..." label while analysis is in progress
- "✓ נותח" label after successful analysis
- AI summary (shown below the row as a bordered callout)
- Category select (user can change inline)
- Delete button

## How Chat Uses Documents
Chat does NOT receive base64 file data via props.
When the user sends a message in Chat:
1. `useClaudeAPI.js` calls `apiGetDocumentContent(doc.id)` for each document
2. The server serves the raw file at GET /api/documents/:id/content
3. The browser converts the file blob to base64
4. The base64 data is forwarded to the Claude API as `document` or `image` content blocks
5. After the API call completes, the base64 is discarded — never stored in React state

## Duplicate Detection
- Computed server-side using SHA-256 of the raw file bytes (Node.js built-in `crypto`)
- Hash stored in `file_hash TEXT UNIQUE` column; a partial unique index (`WHERE file_hash IS NOT NULL`) ensures old rows with null don't conflict
- Detection is content-based, not name-based — renaming a file before re-uploading still triggers the warning
- On 409: `apiUploadDocument` returns the body instead of throwing; Documents.jsx checks `result.duplicate`
- Warning banner: amber background (`#fef3c7`), shows existing document name + upload date, auto-dismisses after 5 s, X button for immediate dismiss

## Delete Flow
1. User clicks "מחק" — button shows "..." and is disabled while in flight
2. `handleDelete(id)` in Documents.jsx awaits `onDelete(id)` (which is `deleteDocument` in App.jsx)
3. `deleteDocument` calls `DELETE /api/documents/:id` and returns the promise
4. Server: deletes related `payment_requests` rows first (CASCADE), then deletes the `documents` row, then `fs.unlinkSync` the file from disk. Returns `{ success: true }`.
5. On success: App.jsx filters the document out of state (UI updates after confirmed server delete)
6. On error: Documents.jsx catches and shows inline "המחיקה נכשלה: ..." message; item stays in the list

## Error Handling
- Upload failed: show inline error "ההעלאה נכשלה, נסו שוב"
- Duplicate upload: show amber warning banner — see Duplicate Detection above
- Delete failed: show inline error "המחיקה נכשלה: <reason>"; document remains in list
- AI analysis failed: document is saved normally; analysis is silently skipped (console.error logged)
- No API key: hint shown in Documents.jsx; analysis skipped
- Server unreachable: fetch calls will throw; show "אין חיבור לשרת" banner

## How to Extend
- Add re-analysis button per document (call POST /api/documents/:id/analyze again)
- Add preview panel (PDF viewer or image preview inline)
- Add document search by category or date range
- Add support for other file types (DOCX extraction via mammoth, etc.)
