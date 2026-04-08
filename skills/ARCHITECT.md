---
# ARCHITECT.md — Bayit BaMoshav: System Design & Decisions
---

## Purpose
A Hebrew RTL React web application to help a couple manage purchasing land in an Israeli moshav and building a house. The app tracks documents, expenses, and enables AI-powered Q&A over their data via the Claude API.

---

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Build | Vite + React | Zero-config, fast HMR, ESM-native |
| UI | Vanilla CSS (no framework) | RTL support is trivial, no class purging issues |
| State | React `useState` + API fetch | Documents and expenses loaded from local Express server on mount |
| Persistence | SQLite (`data/bayit.db`) via `better-sqlite3` | Local, file-based, no cloud dependency |
| Server | Express on port 3001 | Required because browsers cannot access SQLite directly |
| File storage | `data/documents/` (local disk) | Files saved by multer on upload; served back for Claude analysis |
| AI | Claude API (direct browser fetch) | `anthropic-dangerous-allow-browser: true`; API key stored in `localStorage` |
| Language | Hebrew RTL | `<html dir="rtl" lang="he">`, CSS variables for consistent theming |

---

## Folder Structure

```
our_house_project/
├── index.html                  # Vite entry, sets dir=rtl lang=he
├── vite.config.js              # React plugin
├── server.js                   # Express API server (port 3001)
├── package.json
├── data/
│   ├── bayit.db                # SQLite database (auto-created on first run)
│   └── documents/              # Uploaded files stored here by multer
├── src/
│   ├── main.jsx                # ReactDOM.createRoot entry
│   ├── App.jsx                 # Root: tab routing, API fetches, layout
│   ├── App.css                 # CSS variables, grid layout, global styles
│   ├── components/
│   │   ├── MetricsBar.jsx      # Top strip: totals + settings gear
│   │   ├── Sidebar.jsx         # RTL nav tabs
│   │   ├── Documents.jsx       # Upload, list, delete documents
│   │   ├── Expenses.jsx        # Add, list, summarize expenses
│   │   └── Chat.jsx            # Claude AI chat with context injection
│   ├── hooks/
│   │   ├── useAPI.js           # Fetch helpers for all API routes
│   │   └── useClaudeAPI.js     # Claude API call logic
│   └── utils/
│       ├── formatCurrency.js   # ILS Intl.NumberFormat helper
│       └── buildSystemPrompt.js# Constructs Hebrew system prompt with context
└── skills/
    ├── ARCHITECT.md       ← this file
    ├── DOMAIN.md          # Israeli moshav purchase/build domain knowledge
    ├── PROJECT_MANAGER.md # Product backlog, principles, feature status
    ├── UX.md              # UX guidelines, component patterns, visual language
    ├── CHAT.md
    ├── DOCUMENTS.md
    ├── EXPENSES.md
    └── API.md
```

---

## Layout

```
+------------------------------------------+
| MetricsBar (full width, 56px)            |
+------------------+-----------------------+
| Sidebar (220px)  | Content Area          |
| [right side RTL] | [left side RTL]       |
+------------------+-----------------------+
```

CSS Grid: `grid-template-columns: 220px 1fr` with `direction: rtl` — the 220px column naturally appears on the RIGHT side visually.

---

## How to Run

```bash
npm run dev        # starts both server.js (port 3001) and Vite (port 5173) via concurrently
npm run server     # start server only
npm run client     # start Vite only
```

---

## Data Models (SQLite)

### `documents` table
```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
file_name   TEXT        -- original filename
file_path   TEXT        -- filename on disk inside data/documents/
file_type   TEXT        -- MIME type (application/pdf, image/jpeg, etc.)
uploaded_at TEXT        -- ISO timestamp
category    TEXT        -- see DOCUMENTS.md for categories
ai_summary          TEXT
ai_extracted_amount REAL
ai_extracted_payee  TEXT
ai_extracted_date   TEXT
status      TEXT        -- 'processed' | 'error'
```

### `expenses` table
```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
description TEXT
amount      REAL        -- ILS, numeric
category    TEXT        -- see EXPENSES.md for categories
date        TEXT        -- YYYY-MM-DD
notes       TEXT
source_document_id INTEGER  -- FK to documents.id
status      TEXT        -- 'confirmed' | 'pending'
created_at  TEXT        -- ISO timestamp
```

### `bayit_api_key` (localStorage)
Plain text Claude API key. User enters once in settings modal. Stays in `localStorage` — not sent to the local server.

---

## API Routes (server.js)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/documents` | List all documents (metadata only) |
| POST | `/api/documents/upload` | Upload file + save metadata |
| PUT | `/api/documents/:id` | Update document fields (e.g. category) |
| DELETE | `/api/documents/:id` | Delete metadata + file from disk |
| GET | `/api/documents/:id/content` | Serve raw file (used by Chat to send to Claude) |
| GET | `/api/expenses` | List all expenses |
| POST | `/api/expenses` | Add expense |
| PUT | `/api/expenses/:id` | Update expense |
| DELETE | `/api/expenses/:id` | Delete expense |

---

## Key Decisions

1. **Local Express server**: Required because `better-sqlite3` is a native Node module — browsers cannot access it directly. The server runs on port 3001; Vite runs on 5173.
2. **Files stored on disk**: `multer` saves uploads to `data/documents/`. The DB stores only the filename (not base64), keeping the DB small.
3. **Chat fetches file content on demand**: When the user sends a chat message, `useClaudeAPI.js` fetches each document's raw file from `/api/documents/:id/content`, converts it to base64 in the browser, and forwards it to the Claude API. Documents are never persisted as base64 — only fetched transiently for Claude.
4. **API key stays in localStorage**: Convenience over security — this is a personal local tool, not a public app. The key is never sent to the local server.
5. **Integer IDs**: SQLite `AUTOINCREMENT` integers replace the previous `crypto.randomUUID()` strings. The React components use `doc.id` / `expense.id` as before.
6. **RTL-first CSS**: All layout uses CSS Grid with `direction: rtl`.

---

## How to Extend

- **Add a new tab**: Add entry to `Sidebar.jsx` nav items, add case to `App.jsx` tab renderer, create new component in `src/components/`.
- **Add a new expense category**: Update the categories array in `Expenses.jsx` and `buildSystemPrompt.js`.
- **Add AI document analysis on upload**: After `POST /api/documents/upload`, call the Claude API from `server.js` or from the React app with the returned doc ID, then `PUT /api/documents/:id` with the extracted fields.
- **Add Excel export**: Install `xlsx`, add export button to `Expenses.jsx`, call `XLSX.utils.json_to_sheet(expenses)`.

---

## Backup

`data/bayit.db` is **tracked by Git** — committing the repo is the primary backup mechanism. `data/documents/` (the uploaded files) is in `.gitignore` because files can be large. This means:

- All expense and document *metadata* is safe as long as you commit regularly.
- The actual uploaded files (PDFs, images) are **not** backed up by Git. Back them up separately — e.g. copy `data/documents/` to an external drive or cloud folder periodically.
- If you lose `data/documents/` but still have `bayit.db`, the metadata rows remain intact; only the file content (needed for Claude analysis) would be missing.

---

## Gotchas

- `better-sqlite3` is synchronous — all DB calls on the server block the Node event loop. Fine for a single-user local app; would need WAL mode for concurrent access.
- `crypto.randomUUID()` is no longer used for IDs — IDs are integers from SQLite.
- The Claude `document` content block type only supports `application/pdf`. Images use the `image` content block type.
- Hebrew text in `<input>` and `<textarea>` elements inherits `dir="rtl"` from the root.
- `data/` directory is auto-created by `server.js` on startup (`fs.mkdirSync` with `recursive: true`).
