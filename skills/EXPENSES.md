---
# EXPENSES.md — Expense Tracking Logic
---

## Purpose
Tracks all financial expenditures related to the moshav land purchase and house construction.
Split into two sections: pending payment requests (from AI document analysis) and confirmed expenses.

---

## Key Decisions

### Two-stage payment flow
Documents with payment obligations create a `payment_request` (status=pending).
The user reviews and marks it paid — the server then auto-creates an expense row.
Manual expenses can still be added directly via the form.

### Numeric `amount` stored, formatted on display
Amounts are stored as plain numbers (ILS, no currency symbol) in SQLite. All display formatting goes through `formatCurrency(amount)` from `src/utils/formatCurrency.js`, which uses `Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' })`.

### Sorted by date descending in the list
`[...expenses].sort((a, b) => new Date(b.date) - new Date(a.date))` — most recent first.

### Summary table driven by live computation
The category breakdown is derived fresh from the `expenses` prop on every render — no separate derived state.

---

## Storage Schema (SQLite)

### expenses table
```sql
CREATE TABLE IF NOT EXISTS expenses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL,
  amount      REAL NOT NULL,                    -- ILS, total including VAT
  category    TEXT NOT NULL DEFAULT 'אחר',
  date        TEXT NOT NULL,                    -- YYYY-MM-DD
  notes       TEXT,
  source_document_id         INTEGER REFERENCES documents(id),
  source_payment_request_id  INTEGER REFERENCES payment_requests(id),
  amount_before_vat          REAL,              -- null for manual expenses
  vat_amount                 REAL,              -- null for manual expenses
  status      TEXT NOT NULL DEFAULT 'confirmed',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
```

### payment_requests table
```sql
CREATE TABLE IF NOT EXISTS payment_requests (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  source_document_id  INTEGER REFERENCES documents(id),
  description         TEXT,
  payee               TEXT,
  amount_before_vat   REAL,
  vat_required        INTEGER DEFAULT 0,   -- 0/1 boolean
  vat_included        INTEGER DEFAULT 0,   -- 0/1 boolean
  vat_amount          REAL,
  amount_total        REAL,
  due_date            TEXT,               -- YYYY-MM-DD or null
  status              TEXT DEFAULT 'pending',   -- 'pending' | 'paid'
  paid_at             TEXT,
  created_at          TEXT DEFAULT (datetime('now'))
)
```

## Categories (Expenses form)
`'קרקע' | 'בנייה' | 'אדריכלות' | 'משפטי' | 'עיריה/רשויות' | 'תשתיות' | 'אחר'`

The expense category for confirmed payment requests is inherited from the source document's category.

---

## Data Flow

### Payment Request → Expense (confirm-to-pay flow)
1. Document uploaded → AI analysis → server creates payment_request row (status=pending)
2. App.jsx loads payment_requests via `apiGetPaymentRequests()` → GET /api/payment-requests
3. Expenses.jsx renders Section 1 (pending requests); user clicks "סמן כשולם"
4. Inline date picker appears; user selects paid_at date and confirms
5. `onPayRequest(id, paid_at)` → `apiPayPaymentRequest(id, paid_at)` → POST /api/payment-requests/:id/pay
6. Server: marks payment_request status='paid', inserts expense row with all VAT fields
7. Server returns `{ payment_request, expense }`
8. App.jsx: updates paymentRequests state (item disappears from Section 1), prepends expense to expenses state (appears in Section 2)

### Manual Expense
1. User fills form at bottom of Section 2
2. `onAdd({ description, amount, category, date, notes })`
3. `apiAddExpense(expense)` → POST /api/expenses
4. Server inserts row, returns full record
5. App.jsx prepends returned record to state

Edit and delete follow the same pattern via `onUpdate`/`onDelete` → App.jsx calls API → updates state.

---

## UI Structure (Expenses.jsx)

### Props
```
expenses         — array of expense records
paymentRequests  — array of payment_request records (all statuses)
onAdd            — fn(expense) → add manual expense
onDelete         — fn(id) → delete expense
onUpdate         — fn(id, data) → update expense
onPayRequest     — fn(id, paid_at) → pay a pending payment request
```

### Section 1 — דרישות לתשלום (pending)
- Filters paymentRequests where status='pending'
- Per item: description, payee, amount_before_vat (if VAT required), vat_amount, amount_total (bold), due_date
- "סמן כשולם" button → inline date picker → confirm → calls onPayRequest

### Section 2 — הוצאות מאושרות
- All confirmed expenses (manual + paid payment requests)
- Per item: description, category badge, date, amount, "מדרישת תשלום" tag if source_payment_request_id
- Category breakdown summary table above the list
- Manual expense entry form at the bottom

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/payment-requests | List all payment requests |
| POST | /api/payment-requests/:id/pay | Mark paid, auto-create expense. Body: `{ paid_at }` |
| GET | /api/expenses | List all expenses |
| POST | /api/expenses | Add manual expense |
| PUT | /api/expenses/:id | Update expense |
| DELETE | /api/expenses/:id | Delete expense |

---

## Gotchas

- The `amount` field in the form is a string while being typed (`form.amount`), cast to `Number()` before calling `onAdd`. Always use `Number(e.amount)` when summing.
- The `date` field is stored as `YYYY-MM-DD` (ISO local date), not a full ISO timestamp.
- `id` is an integer (SQLite AUTOINCREMENT), not a UUID string.
- `vat_required` and `vat_included` in payment_requests are stored as 0/1 integers (SQLite has no boolean). Cast with `!!pr.vat_required` in JS if needed.
- `amount_before_vat` and `vat_amount` are null for manually entered expenses.

---

## How to Extend

- **Add a new expense category**: Add the Hebrew string to the `CATEGORIES` array in `Expenses.jsx` AND in `buildSystemPrompt.js`.
- **Budget tracking**: Add a `budget` prop and render a progress bar showing `total / budget`.
- **Filter by date range**: Add date range inputs above Section 2 and filter `sorted`.
- **Show VAT breakdown in confirmed expenses**: Show `amount_before_vat` + `vat_amount` inline when non-null.
