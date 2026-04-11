# CURRENT_STATE.md — Bayit BaMoshav: Exact App State

> **Last updated:** 2026-04-11
> This file is the ground truth for new Claude sessions. Read it first before touching any code.
> Update it after every significant change.

---

## 1. Working Features ✅ / Broken or Incomplete ❌

| Feature | Status | Notes |
|---|---|---|
| Document upload (PDF + images) | ✅ | Drag-and-drop + click; up to 20MB per file |
| Duplicate detection on upload | ✅ | SHA-256 hash; shows amber warning banner 5 s |
| Auto-analysis after upload | ✅ | Runs if API key is set; skipped silently if not |
| AI document analysis (manual button) | ✅ | "נתח מסמך" / "נתח מחדש" per document |
| Rich analysis panel | ✅ | Summary, parties, important dates, obligations, lawyer questions |
| Per-document Q&A (DocChat) | ✅ | "💬 שאל" inline chat; session-only history |
| Document category select (inline) | ✅ | 7 categories; persisted to DB immediately |
| Document category filter chips | ✅ | Appears only when ≥2 categories present |
| Document deletion | ✅ | Cascades to payment_requests; deletes file from disk |
| Payment requests (from AI analysis) | ✅ | Created automatically when document has payment info |
| Mark payment request as paid | ✅ | Inline date picker → auto-creates confirmed expense |
| Manual expense entry | ✅ | Always-visible form at bottom of Expenses tab |
| Expense editing | ✅ | In-place form reuse; "עריכה" button |
| Expense deletion | ✅ | "מחק" button; instant |
| Expense category breakdown table | ✅ | % column + totals |
| Export expenses to CSV | ✅ | "ייצוא CSV" button; appears only when expenses exist |
| AI chat (main chat tab) | ✅ | OpenAI gpt-4o-mini; injects expenses + document metadata + raw files |
| Quick-question chips in chat | ✅ | 5 chips; hidden after first message sent |
| Dashboard overview tab | ✅ | Stat cards + recent expenses + recent docs |
| Dashboard pending-payment badge | ✅ | Red count card; clickable → goes to Expenses tab |
| MetricsBar totals | ✅ | Total spent, expense count, document count |
| Settings modal (API key) | ✅ | Stores in localStorage['bayit_api_key'] |
| Hebrew RTL UI | ✅ | dir=rtl on html; all strings in Hebrew |
| SQLite persistence | ✅ | data/bayit.db; auto-created on first run |
| File persistence on disk | ✅ | data/documents/{uuid}.{ext} |
| Hebrew filename handling (Windows) | ✅ | latin1→utf8 re-decode in multer handler |
| Quote comparison module (הצעות מחיר) | ✅ | Tab per category; suppliers table; stars rating; status; search |
| Quote → payment request auto-creation | ✅ | Status → "נבחר" auto-creates pending payment_request; toast feedback; duplicate-safe |
| Timeline / milestone tracker | ❌ | Not built; P2 backlog |
| Chat history persistence | ❌ | Session-only (useState); not saved to DB |
| Mobile layout | ❌ | Not tested/optimised; desktop only for now |
| Streaming AI responses | ❌ | Not built; full response waited |

---

## 2. AI Provider

| Setting | Value |
|---|---|
| **Provider** | **OpenAI** |
| **Model** | **gpt-4o-mini** |
| API key source | User enters in Settings modal → `localStorage['bayit_api_key']` → sent in request body to server |
| Server env fallback | `OPENAI_API_KEY` in `.env` (loaded via `node --env-file=.env server.js`) |
| Call path | Browser → Express server (port 3001) → OpenAI API. **All AI calls are server-side.** |

> **Important:** `src/hooks/useClaudeAPI.js` is misnamed — it calls OpenAI, not Claude.
> `apiGetDocumentContent()` in `useAPI.js` is also a leftover from the Claude/browser-direct era
> and is no longer used (chat now goes through the server).

---

## 3. All API Routes (server.js, port 3001)

### Documents

| Method | Path | What it does |
|---|---|---|
| GET | `/api/documents` | List all documents (metadata only, ordered by upload date DESC) |
| POST | `/api/documents/upload` | Upload file via multer; compute SHA-256; check duplicate (409); insert row; return doc record |
| POST | `/api/documents/:id/analyze` | Extract PDF text or image base64; call OpenAI with ANALYSIS_PROMPT; update doc row with rich fields; create payment_request if needed; return `{ document, payment_request }` |
| POST | `/api/documents/:id/ask` | Load file; extract content; call OpenAI with question; return `{ answer }` |
| PUT | `/api/documents/:id` | Update arbitrary fields on a document row; return updated record |
| DELETE | `/api/documents/:id` | Delete related payment_requests → delete document row → delete file from disk |
| GET | `/api/documents/:id/content` | Serve raw file bytes with correct Content-Type (used for browser download / old Claude flow) |

### Chat

| Method | Path | What it does |
|---|---|---|
| POST | `/api/chat` | Build OpenAI messages from history + system prompt + inline doc content (PDF text or image base64); call gpt-4o-mini; return `{ answer }` |

### Payment Requests

| Method | Path | What it does |
|---|---|---|
| GET | `/api/payment-requests` | List all payment requests ordered by created_at DESC |
| POST | `/api/payment-requests/:id/pay` | Mark as paid; auto-insert confirmed expense row; return `{ payment_request, expense }` |

### Expenses

| Method | Path | What it does |
|---|---|---|
| GET | `/api/expenses` | List all expenses ordered by date DESC, created_at DESC |
| POST | `/api/expenses` | Add manual expense; return saved record |
| PUT | `/api/expenses/:id` | Update expense fields; return updated record |
| DELETE | `/api/expenses/:id` | Delete expense row |

---

## 4. SQLite Tables (`data/bayit.db`)

### `documents`

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| file_name | TEXT NOT NULL | Original Hebrew filename (re-decoded from latin1 on Windows) |
| file_path | TEXT NOT NULL | UUID filename on disk inside `data/documents/` |
| file_type | TEXT NOT NULL | MIME type (application/pdf, image/jpeg, etc.) |
| uploaded_at | TEXT NOT NULL | ISO timestamp (auto) |
| category | TEXT NOT NULL | Default 'אחר'; one of 7 categories |
| ai_summary | TEXT | Hebrew 2-3 sentence summary from OpenAI |
| ai_extracted_amount | REAL | Legacy field (not populated by current analysis) |
| ai_extracted_payee | TEXT | Legacy field (not populated by current analysis) |
| ai_extracted_date | TEXT | Legacy field (not populated by current analysis) |
| status | TEXT NOT NULL | 'processed' (uploaded) or 'analyzed' (AI ran) |
| file_hash | TEXT UNIQUE | SHA-256 hex; partial unique index (WHERE NOT NULL) |
| ai_parties | TEXT | JSON array: `[{ role, name }]` — stored as TEXT, parsed by `parseDocRow()` |
| ai_important_dates | TEXT | JSON array: `[{ label, date }]` — stored as TEXT, parsed by `parseDocRow()` |
| ai_obligations | TEXT | JSON array of Hebrew strings — stored as TEXT, parsed by `parseDocRow()` |
| ai_lawyer_questions | TEXT | JSON array of Hebrew strings — stored as TEXT, parsed by `parseDocRow()` |

### `expenses`

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| description | TEXT NOT NULL | |
| amount | REAL NOT NULL | ILS, total including VAT |
| category | TEXT NOT NULL | Default 'אחר' |
| date | TEXT NOT NULL | YYYY-MM-DD |
| notes | TEXT | Optional |
| source_document_id | INTEGER | FK → documents.id (nullable) |
| status | TEXT NOT NULL | Default 'confirmed' |
| created_at | TEXT NOT NULL | ISO timestamp (auto) |
| source_payment_request_id | INTEGER | FK → payment_requests.id; set when created from paying a PR |
| amount_before_vat | REAL | Null for manual expenses |
| vat_amount | REAL | Null for manual expenses |

### `payment_requests`

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| source_document_id | INTEGER | FK → documents.id |
| description | TEXT | What the payment is for |
| payee | TEXT | Who to pay |
| amount_before_vat | REAL | |
| vat_required | INTEGER | 0/1 boolean |
| vat_included | INTEGER | 0/1 boolean |
| vat_amount | REAL | |
| amount_total | REAL | Final amount due |
| due_date | TEXT | YYYY-MM-DD or null |
| status | TEXT | 'pending' or 'paid' |
| paid_at | TEXT | Date paid; set when status → 'paid' |
| created_at | TEXT | ISO timestamp (auto) |
| source_quote_id | INTEGER | FK → quotes.id; set when created from a selected quote |

---

## 5. React Components

### `App.jsx`
Root component. Owns all state: `documents`, `expenses`, `paymentRequests`, `apiKey`, `activeTab`. Fetches all data from the Express server on mount. Renders layout: MetricsBar + Sidebar + main content area. Contains inline `Dashboard` component.

### `Dashboard` (inline in App.jsx)
Overview tab. Shows 4 stat cards (total spent, expense count, document count, pending payment requests). Shows 2 side-by-side panels: last 5 expenses + last 5 documents. Clicking "כל ההוצאות" / "כל המסמכים" switches tab.

### `MetricsBar.jsx`
Sticky top bar (56px). Shows app title, total spent (ILS), expense count, document count. Settings gear button opens modal to enter/save the OpenAI API key (stored in `localStorage['bayit_api_key']`).

### `Sidebar.jsx`
Left rail (220px, visually right in RTL). Four nav tabs: בית (dashboard), מסמכים, הוצאות, שאל את הבית. Active tab highlighted in green.

### `Documents.jsx`
Documents tab. Sub-components: `AnalysisPanel`, `DocChat`.
- Upload zone (drag-and-drop or click); calls `apiUploadDocument` then `handleAnalyze` auto if API key set
- Duplicate warning banner (amber, 5 s auto-dismiss)
- Category filter chips (appears when ≥2 categories used)
- Per-document card with: icon, filename, upload date, analyzing indicator, "✓ נותח" badge, "▼ פרטי ניתוח" toggle, "💬 שאל" toggle, "נתח מסמך/מחדש" button, category select, delete button
- `AnalysisPanel`: expandable panel showing summary, parties grid, important dates, obligations, lawyer questions
- `DocChat`: inline Q&A per document; session-only history; calls `POST /api/documents/:id/ask`

### `Expenses.jsx`
Expenses tab. Sub-component: `PaymentRequestItem`.
- **Section 1** — "דרישות לתשלום": pending payment requests with description, payee, VAT breakdown, due date, "סמן כשולם" → inline date picker → `POST /api/payment-requests/:id/pay`
- **Section 2** — "הוצאות מאושרות": category breakdown table + sorted expense list with edit/delete + always-visible add/edit form
- `PaymentRequestItem`: renders one pending request; manages its own date-picker state
- CSV export button (visible when expenses exist)

### `Chat.jsx`
Main chat tab. Uses `useClaudeAPI` hook. Quick-question chips (disappear after first send). Message list (user right/teal, assistant left/gray). "חושב..." loading state. Error banner on failure. Input disabled when no API key set — shows warning banner.

### Hooks

| File | Role |
|---|---|
| `src/hooks/useClaudeAPI.js` | (Misnamed) Builds system prompt, calls `apiChat()`, manages loading/error state |
| `src/hooks/useAPI.js` | All fetch helpers for every API route |

### Utils

| File | Role |
|---|---|
| `src/utils/buildSystemPrompt.js` | Builds Hebrew system prompt with full expense table, category breakdown, document metadata |
| `src/utils/formatCurrency.js` | `Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' })` |
| `src/utils/exportExpenses.js` | Exports expenses array to CSV download |

---

## 6. Known Bugs / Issues

1. **`useClaudeAPI.js` is misnamed** — it calls OpenAI (via server), not Claude. Causes confusion in new sessions. Safe to rename to `useAI.js` if desired.

2. **`apiGetDocumentContent()` in `useAPI.js` is dead code** — fetches file bytes in the browser. Was used in the old Claude/browser-direct flow. No longer called anywhere. Can be removed.

3. **`src/__init__.py` exists** — stray Python file in the `src/` folder. Should be deleted.

4. **`CHAT.md` skill file is outdated** — still describes the old Claude/browser-direct approach with `anthropic-dangerous-allow-browser: true`. The actual implementation is OpenAI/server-side.

5. **`PROJECT_MANAGER.md` feature table is outdated** — does not reflect the full current feature set (dashboard tab, payment requests, per-doc Q&A, duplicate detection, etc. all missing).

6. **Chat history is session-only** — refreshing the page loses all chat history. Intentional design decision but worth noting.

7. **`ai_extracted_amount`, `ai_extracted_payee`, `ai_extracted_date`** — legacy columns on the `documents` table. The current analysis prompt does not populate these (it uses `payment_request` object instead). Columns remain in DB but are always null for newly analyzed documents.

---

## 7. What We Were Working On Last

**Quote → payment request auto-creation (2026-04-11)**

When a quote's status is changed to "נבחר" (via the status dropdown OR the edit form), the server now:
1. Checks `payment_requests.source_quote_id` for an existing PR linked to this quote
2. If none → inserts a new `payment_requests` row with `source_quote_id = quote.id`
3. Returns `{ quote, payment_request, no_amount_warning }` — old callers that only read `quote` still work via `result.quote ?? result` fallback in App.jsx

Edge cases: no amount → `no_amount_warning: true` (no PR created); duplicate → skipped silently. Neither deletes an existing PR when status changes away from "נבחר".

---

## 8. What We Were Working On Before That

**Migration from Claude API → OpenAI API.**

The app was originally built with the Claude API called directly from the browser (`anthropic-dangerous-allow-browser: true`). It was migrated to:
- **Provider:** OpenAI (`gpt-4o-mini`)
- **Architecture:** All AI calls go through the Express server (never browser-direct)
- **API key flow:** User enters key in Settings → saved to `localStorage['bayit_api_key']` → sent in request body to `localhost:3001` → server creates `new OpenAI({ apiKey })` per request

**The "OpenAI API key issue":** The server requires either:
- `OPENAI_API_KEY` set in `.env` (loaded via `node --env-file=.env server.js`), OR
- The user's key entered in the Settings modal (⚙️), which is sent as `apiKey` in the request body

If neither is present, all `/api/chat`, `/api/documents/:id/analyze`, and `/api/documents/:id/ask` calls return `400 { error: 'מפתח API חסר' }`. The UI shows a warning but the error handling in some paths may not surface this clearly to the user.

**To run the app:**
```bash
# Option 1: set key in .env
echo "OPENAI_API_KEY=sk-proj-..." > .env
npm run dev

# Option 2: just run, enter key in ⚙️ Settings modal at runtime
npm run dev
```

---

## 8. How to Run

```bash
npm run dev        # starts server.js (port 3001) + Vite (port 5173) via concurrently
npm run server     # server only
npm run client     # Vite only
```

Data is at `data/bayit.db` (SQLite, git-tracked) and `data/documents/` (files on disk, gitignored).
