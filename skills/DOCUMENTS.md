# DOCUMENTS.md — Document Management Skill

## Purpose
Handle document upload, local file storage, and AI analysis with automatic
expense extraction and user confirmation.

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
  status      TEXT NOT NULL DEFAULT 'processed'
);
```

## Upload Flow

Step 1 — User selects or drags a file (PDF or image) in Documents.jsx
Step 2 — React calls `apiUploadDocument(file)` from `src/hooks/useAPI.js`
Step 3 — POST /api/documents/upload with multipart/form-data
Step 4 — multer saves file to data/documents/{timestamp}-{originalname}
Step 5 — server inserts metadata row, returns full document record
Step 6 — React adds the returned document to state via `onAdd(doc)`

AI analysis (not yet wired up — planned):
Step 7 — After upload, call Claude API with file content to extract:
  - category
  - short Hebrew summary (2-3 sentences)
  - payment amount (numeric, ₪)
  - payee name
  - payment date
Step 8 — PUT /api/documents/:id with the extracted fields
Step 9 — If amount found → show confirmation card (see below)
Step 10 — User confirms → POST /api/expenses with source_document_id

## Document Categories
Always classify into one of:
- היתר בנייה
- חוזה
- קבלה
- שמאות
- מסמך רשמי
- אחר

## AI Extraction Prompt
Send to Claude API immediately after upload.
The prompt must request a JSON response only, no prose:
```
You are analyzing a document related to an Israeli moshav land purchase
and home building project. Extract the following and respond ONLY with
valid JSON, no explanation:
{
  "category": "one of: היתר בנייה / חוזה / קבלה / שמאות / מסמך רשמי / אחר",
  "summary": "2-3 sentence summary in Hebrew",
  "has_payment": true or false,
  "amount": number or null,
  "payee": "who was paid, in Hebrew, or null",
  "payment_date": "YYYY-MM-DD or null"
}
```

## Confirmation Card (UI)
When AI finds a payment (has_payment: true), show a card above the
document list — do not auto-add to expenses:

```
┌─────────────────────────────────────────────┐
│ זיהינו תשלום במסמך                          │
│                                             │
│ מוטב:   עורך דין כהן                        │
│ סכום:   ₪1,180                              │
│ תאריך:  15/03/2025                          │
│ מסמך:   חשבונית-עו"ד.pdf                   │
│                                             │
│ [התעלם]              [הוסף להוצאות ✓]       │
└─────────────────────────────────────────────┘
```

- "הוסף להוצאות" → POST /api/expenses with source_document_id
- "התעלם" → dismisses the card
- Card disappears after either action

## Document List Display
Each document shows:
- File name (truncated if long)
- Category select (user can change inline)
- Upload date
- Delete button

## How Chat Uses Documents
Chat does NOT receive base64 file data via props.
When the user sends a message in Chat:
1. `useClaudeAPI.js` calls `apiGetDocumentContent(doc.id)` for each document
2. The server serves the raw file at GET /api/documents/:id/content
3. The browser converts the file blob to base64
4. The base64 data is forwarded to the Claude API as `document` or `image` content blocks
5. After the API call completes, the base64 is discarded — never stored in React state

## Error Handling
- Upload failed: show inline error "ההעלאה נכשלה, נסו שוב"
- AI analysis failed: save document anyway, mark category as "אחר",
  show "הניתוח האוטומטי נכשל" badge — user can re-trigger manually
- Server unreachable: fetch calls will throw; show "אין חיבור לשרת" banner

## How to Extend
- Wire up AI analysis on upload: call Claude from Documents.jsx after apiUploadDocument returns, then apiUpdateDocument with extracted fields
- Add document search by category or date range
- Add re-analysis button per document
- Add preview panel (PDF viewer or image preview)
- Add ai_summary display (collapsed by default, expand on click)
