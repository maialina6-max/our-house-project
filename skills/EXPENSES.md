---
# EXPENSES.md — Expense Tracking Logic
---

## Purpose
Tracks all financial expenditures related to the moshav land purchase and house construction. Provides a form to add expenses, a sortable list, and a category breakdown summary table.

---

## Key Decisions

### Numeric `amount` stored, formatted on display
Amounts are stored as plain JavaScript numbers (ILS, no currency symbol). All display formatting goes through `formatCurrency(amount)` from `src/utils/formatCurrency.js`, which uses `Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' })`.

### Sorted by date descending in the list
`[...expenses].sort((a, b) => new Date(b.date) - new Date(a.date))` — most recent first. The original order in localStorage is preserved (newest first by insertion).

### Summary table driven by live computation
The category breakdown is derived fresh from the `expenses` prop on every render — no separate derived state. React re-renders on any expense change, keeping the table always correct.

---

## Storage Schema

```js
{
  id: string,          // crypto.randomUUID()
  description: string, // free text
  amount: number,      // ILS, numeric (not string)
  category: string,    // see categories below
  date: string,        // YYYY-MM-DD
  notes: string,       // optional free text
  createdAt: string,   // ISO timestamp of record creation
}
```

## Categories
`'קרקע' | 'בנייה' | 'אדריכלות' | 'משפטי' | 'עיריה/רשויות' | 'תשתיות' | 'אחר'`

---

## How to Extend

- **Add a new category**: Add the Hebrew string to the `CATEGORIES` array in `Expenses.jsx` AND in `buildSystemPrompt.js` (so the AI recognizes it).
- **Edit an existing expense**: Add an `onUpdate(id, patch)` prop; render an edit form inline when the user clicks an expense row.
- **Export to CSV**: Map `expenses` to CSV rows with `amount` formatted as a number (not currency string). Use a `<a download>` with a `data:text/csv` URI.
- **Budget tracking**: Add a `budget` prop (total project budget) and render a progress bar showing `total / budget`.

---

## Gotchas

- The `amount` field in the form is a string while being typed (`form.amount`), cast to `Number()` when creating the expense object. Always use `Number(e.amount)` when summing — never rely on JS implicit coercion.
- Deleting an expense is permanent. Consider a confirmation step.
- The `date` field is stored as `YYYY-MM-DD` (ISO local date), not a full ISO timestamp. This avoids timezone issues with date-only values.
