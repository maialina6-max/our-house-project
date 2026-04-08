---
# EXPENSES.md — Expense Tracking Logic
---

## Purpose
Tracks all financial expenditures related to the moshav land purchase and house construction. Provides a form to add expenses, a sortable list, and a category breakdown summary table.

---

## Key Decisions

### Numeric `amount` stored, formatted on display
Amounts are stored as plain numbers (ILS, no currency symbol) in SQLite. All display formatting goes through `formatCurrency(amount)` from `src/utils/formatCurrency.js`, which uses `Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' })`.

### Sorted by date descending in the list
`[...expenses].sort((a, b) => new Date(b.date) - new Date(a.date))` — most recent first.

### Summary table driven by live computation
The category breakdown is derived fresh from the `expenses` prop on every render — no separate derived state.

---

## Storage Schema (SQLite)

```sql
CREATE TABLE IF NOT EXISTS expenses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL,
  amount      REAL NOT NULL,       -- ILS, numeric
  category    TEXT NOT NULL DEFAULT 'אחר',
  date        TEXT NOT NULL,       -- YYYY-MM-DD
  notes       TEXT,
  source_document_id INTEGER REFERENCES documents(id),
  status      TEXT NOT NULL DEFAULT 'confirmed',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
```

The React component receives expense objects with these exact field names.
`id` and `created_at` are assigned by the server — the component does not generate them.

## Categories
`'קרקע' | 'בנייה' | 'אדריכלות' | 'משפטי' | 'עיריה/רשויות' | 'תשתיות' | 'אחר'`

---

## Data Flow

1. On mount, `App.jsx` calls `apiGetExpenses()` → GET /api/expenses → sets state
2. User submits form → `Expenses.jsx` calls `onAdd({ description, amount, category, date, notes })`
3. `App.jsx`'s `addExpense` calls `apiAddExpense(expense)` → POST /api/expenses
4. Server inserts row, returns full record (with `id` and `created_at`)
5. `App.jsx` prepends returned record to state

Edit and delete follow the same pattern: component calls `onUpdate`/`onDelete` → App.jsx calls API → updates state with server response.

---

## How to Extend

- **Add a new category**: Add the Hebrew string to the `CATEGORIES` array in `Expenses.jsx` AND in `buildSystemPrompt.js` (so the AI recognizes it).
- **Budget tracking**: Add a `budget` prop (total project budget) and render a progress bar showing `total / budget`.
- **Link expense to document**: Pass `source_document_id` when calling `onAdd` (e.g. from the Documents confirmation card).

---

## Gotchas

- The `amount` field in the form is a string while being typed (`form.amount`), cast to `Number()` before calling `onAdd`. Always use `Number(e.amount)` when summing.
- The `date` field is stored as `YYYY-MM-DD` (ISO local date), not a full ISO timestamp. This avoids timezone issues with date-only values.
- `id` is now an integer (SQLite AUTOINCREMENT), not a UUID string.
