---
# ARCHITECT.md — Bayit BaMoshav: System Design & Decisions
---

## Purpose
A single-page Hebrew RTL React web application to help a couple manage purchasing land in an Israeli moshav and building a house. The app tracks documents, expenses, and enables AI-powered Q&A over their data via the Claude API.

---

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Build | Vite + React | Zero-config, fast HMR, ESM-native |
| UI | Vanilla CSS (no framework) | RTL support is trivial, no class purging issues |
| State | React `useState` + `useLocalStorage` hook | No backend needed; all data is local to the couple |
| Persistence | `localStorage` | Simplest offline-first; no server needed |
| AI | Claude API (direct browser fetch) | `anthropic-dangerous-allow-browser: true` header; API key stored in localStorage |
| Language | Hebrew RTL | `<html dir="rtl" lang="he">`, CSS variables for consistent theming |

---

## Folder Structure

```
our_house_project/
├── index.html                  # Vite entry, sets dir=rtl lang=he
├── vite.config.js              # React plugin + proxy for Claude API
├── package.json
├── src/
│   ├── main.jsx                # ReactDOM.createRoot entry
│   ├── App.jsx                 # Root: tab routing, localStorage reads, layout
│   ├── App.css                 # CSS variables, grid layout, global styles
│   ├── components/
│   │   ├── MetricsBar.jsx      # Top strip: totals + settings gear
│   │   ├── Sidebar.jsx         # RTL nav tabs
│   │   ├── Documents.jsx       # Upload, list, delete documents
│   │   ├── Expenses.jsx        # Add, list, summarize expenses
│   │   └── Chat.jsx            # Claude AI chat with context injection
│   ├── hooks/
│   │   ├── useLocalStorage.js  # Generic localStorage state hook
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

## Data Models (localStorage)

### `bayit_documents` (array)
```js
{ id, name, type, category, size, uploadedAt, data }
// data = base64 string (no data URI prefix)
// categories: 'היתר בנייה' | 'חוזה' | 'קבלה' | 'מסמך רשמי' | 'אחר'
```

### `bayit_expenses` (array)
```js
{ id, description, amount, category, date, notes, createdAt }
// amount in ILS (numeric)
// categories: 'קרקע' | 'בנייה' | 'אדריכלות' | 'משפטי' | 'עיריה/רשויות' | 'אחר'
```

### `bayit_api_key` (string)
Plain text Claude API key. User enters once in settings modal.

---

## Key Decisions

1. **No backend**: All data in localStorage. Simple for a two-person household. No auth needed.
2. **API key in localStorage**: Convenience over security — this is a personal local tool, not a public app.
3. **Documents not persisted in chat history**: Documents injected only into the current user turn to avoid token explosion on repeated questions. See `CHAT.md`.
4. **Base64 storage**: Files stored as base64 in localStorage. Works for small files (PDFs, photos). Large files (>5MB) may hit localStorage limits (~10MB total).
5. **Dev proxy for Claude API**: `vite.config.js` proxies `/api/claude` → `https://api.anthropic.com/v1/messages`. In production, use `anthropic-dangerous-allow-browser: true` header with direct HTTPS calls.
6. **RTL-first CSS**: All layout uses CSS Grid with `direction: rtl`. Flexbox elements also inherit RTL naturally.

---

## How to Extend

- **Add a new tab**: Add entry to `Sidebar.jsx` nav items, add case to `App.jsx` tab renderer, create new component in `src/components/`.
- **Add a new expense category**: Update the categories array in `Expenses.jsx` and `buildSystemPrompt.js`.
- **Replace localStorage with a backend**: Swap `useLocalStorage` hook for React Query + fetch calls. Data models are already serialization-friendly.
- **Add Excel export**: Install `xlsx`, add export button to `Expenses.jsx`, call `XLSX.utils.json_to_sheet(expenses)`.

---

## Gotchas

- `localStorage` is synchronous and blocks the main thread for large reads/writes. Base64 documents can be large.
- `localStorage` limit is ~5–10MB per origin — advise users to keep documents small.
- `crypto.randomUUID()` requires a secure context (HTTPS or localhost). Works fine in Vite dev server.
- The Claude `document` content block type only supports `application/pdf`. Images use the `image` content block type instead.
- Hebrew text in `<input>` and `<textarea>` elements inherits `dir="rtl"` from the root, but `placeholder` text also renders RTL correctly in modern browsers.
