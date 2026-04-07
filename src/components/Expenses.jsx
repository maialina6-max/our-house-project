import { useState } from 'react'
import { formatCurrency } from '../utils/formatCurrency'
import { exportExpensesToCSV } from '../utils/exportExpenses'

const CATEGORIES = ['קרקע', 'בנייה', 'אדריכלות', 'משפטי', 'עיריה/רשויות', 'תשתיות', 'אחר']

const EMPTY_FORM = {
  description: '',
  amount: '',
  category: 'אחר',
  date: new Date().toISOString().slice(0, 10),
  notes: '',
}

export default function Expenses({ expenses, onAdd, onDelete, onUpdate }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)

  const sorted = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date))

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  const byCategory = {}
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount)
  }
  const categoryBreakdown = Object.entries(byCategory).sort((a, b) => b[1] - a[1])

  function startEdit(expense) {
    setForm({
      description: expense.description,
      amount: String(expense.amount),
      category: expense.category,
      date: expense.date,
      notes: expense.notes || '',
    })
    setEditingId(expense.id)
  }

  function cancelEdit() {
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.description || !form.amount || !form.date) return
    if (editingId) {
      onUpdate(editingId, {
        description: form.description,
        amount: Number(form.amount),
        category: form.category,
        date: form.date,
        notes: form.notes,
      })
      setEditingId(null)
    } else {
      onAdd({
        id: crypto.randomUUID(),
        description: form.description,
        amount: Number(form.amount),
        category: form.category,
        date: form.date,
        notes: form.notes,
        createdAt: new Date().toISOString(),
      })
    }
    setForm(EMPTY_FORM)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>הוצאות הפרויקט</h2>
        {expenses.length > 0 && (
          <button className="btn btn-secondary" onClick={() => exportExpensesToCSV(expenses)}>ייצוא CSV</button>
        )}
      </div>

      {categoryBreakdown.length > 0 && (
        <div className="card">
          <div className="card-title">סיכום לפי קטגוריה</div>
          <table className="summary-table">
            <thead>
              <tr>
                <th>קטגוריה</th>
                <th>סה"כ</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {categoryBreakdown.map(([cat, amount]) => (
                <tr key={cat}>
                  <td>{cat}</td>
                  <td>{formatCurrency(amount)}</td>
                  <td>{total > 0 ? ((amount / total) * 100).toFixed(1) : 0}%</td>
                </tr>
              ))}
              <tr className="total-row">
                <td>סה"כ</td>
                <td>{formatCurrency(total)}</td>
                <td>100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {sorted.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, margin: '32px 0' }}>
          עוד לא נרשמו הוצאות. השתמשו בטופס למטה.
        </p>
      ) : (
        <div className="expense-list" style={{ marginBottom: 24 }}>
          {sorted.map((e) => (
            <div key={e.id} className="expense-item">
              <div className="expense-info">
                <div className="expense-desc">{e.description}</div>
                <div className="expense-meta">
                  <span className="badge">{e.category}</span>
                  <span>{new Date(e.date).toLocaleDateString('he-IL')}</span>
                  {e.notes && <span>{e.notes}</span>}
                </div>
              </div>
              <span className="expense-amount">{formatCurrency(e.amount)}</span>
              <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: 13 }} onClick={() => startEdit(e)}>עריכה</button>
              <button className="btn btn-danger" onClick={() => onDelete(e.id)}>מחק</button>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-title">{editingId ? 'עריכת הוצאה' : 'הוסף הוצאה'}</div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>תיאור</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="למשל: תשלום לעורך דין"
              required
            />
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>סכום (₪)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
                required
                dir="ltr"
              />
            </div>
            <div className="form-group">
              <label>תאריך</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
                dir="ltr"
              />
            </div>
          </div>
          <div className="form-group">
            <label>קטגוריה</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>הערות (אופציונלי)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="פרטים נוספים..."
            />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            {editingId && (
              <button type="button" className="btn btn-secondary" onClick={cancelEdit}>ביטול</button>
            )}
            <button type="submit" className="btn btn-primary">{editingId ? 'עדכן הוצאה' : 'שמור הוצאה'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
