import { useState } from 'react'
import { formatCurrency } from '../utils/formatCurrency'
import {
  apiAddQuoteCategory, apiDeleteQuoteCategory,
  apiAddQuote, apiUpdateQuote, apiDeleteQuote,
} from '../hooks/useAPI'

const STATUS_OPTIONS = ['פתוחה', 'בטיפול', 'נבחר', 'נדחה']

const STATUS_STYLE = {
  נבחר: { background: '#E1F5EE', color: '#065f46' },
  נדחה: { background: '#f3f4f6', color: '#9ca3af' },
}

const EMOJI_OPTIONS = ['📋', '🏦', '📐', '🏗️', '🧱', '🔨', '🎨', '⚡', '🪟', '🚿', '🌿', '🏠', '🔧', '📏', '💡']

function Stars({ value, onChange }) {
  const [hover, setHover] = useState(0)
  return (
    <span style={{ display: 'inline-flex', gap: 1, cursor: onChange ? 'pointer' : 'default', fontSize: 16 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          style={{ color: n <= (hover || value || 0) ? '#f59e0b' : '#d1d5db', userSelect: 'none' }}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(0)}
          onClick={() => onChange && onChange(n === value ? 0 : n)}
        >
          ★
        </span>
      ))}
    </span>
  )
}

const EMPTY_FORM = {
  supplier_name: '',
  amount: '',
  duration_days: '',
  reliability: 0,
  contact: '',
  offer_date: '',
  my_opinion: '',
  notes: '',
  status: 'פתוחה',
}

function QuoteRow({ quote, onUpdate, onDelete, onPaymentRequestAdded }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null) // { type: 'success'|'warning', text }

  const rowStyle = STATUS_STYLE[quote.status] || {}

  function showToast(type, text) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 3000)
  }

  function handleResult(result, supplierName) {
    if (!result) return
    if (result.no_amount_warning) {
      showToast('warning', 'לא הוגדר סכום להצעה — דרישת תשלום לא נוצרה')
    } else if (result.payment_request) {
      showToast('success', `✓ נוספה דרישת תשלום עבור ${supplierName}`)
      onPaymentRequestAdded(result.payment_request)
    }
  }

  function startEdit() {
    setForm({
      supplier_name: quote.supplier_name,
      amount: quote.amount != null ? String(quote.amount) : '',
      duration_days: quote.duration_days != null ? String(quote.duration_days) : '',
      reliability: quote.reliability || 0,
      contact: quote.contact || '',
      offer_date: quote.offer_date || '',
      my_opinion: quote.my_opinion || '',
      notes: quote.notes || '',
      status: quote.status || 'פתוחה',
    })
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const result = await onUpdate(quote.id, {
        supplier_name: form.supplier_name.trim(),
        amount: form.amount !== '' ? Number(form.amount) : null,
        duration_days: form.duration_days !== '' ? Number(form.duration_days) : null,
        reliability: form.reliability || null,
        contact: form.contact || null,
        offer_date: form.offer_date || null,
        my_opinion: form.my_opinion || null,
        notes: form.notes || null,
        status: form.status,
      })
      setEditing(false)
      setForm(null)
      if (result) setExpanded(false)
      handleResult(result, form.supplier_name.trim())
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(newStatus) {
    const result = await onUpdate(quote.id, { status: newStatus })
    handleResult(result, quote.supplier_name)
  }

  if (editing && form) {
    return (
      <tr style={{ background: '#f0fdf4' }}>
        <td colSpan={7} style={{ padding: '14px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>שם ספק</label>
              <input
                type="text"
                value={form.supplier_name}
                onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
                placeholder="שם החברה / איש הקשר"
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>סכום (₪)</label>
              <input
                type="number"
                min="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
                dir="ltr"
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>זמן ביצוע (ימים)</label>
              <input
                type="number"
                min="0"
                value={form.duration_days}
                onChange={(e) => setForm({ ...form, duration_days: e.target.value })}
                placeholder="0"
                dir="ltr"
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>דירוג</label>
              <div style={{ paddingTop: 8 }}>
                <Stars value={form.reliability} onChange={(v) => setForm({ ...form, reliability: v })} />
              </div>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>סטטוס</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>פרטי קשר</label>
              <input
                type="text"
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                placeholder="טלפון / אימייל"
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>תאריך הצעה</label>
              <input
                type="date"
                value={form.offer_date}
                onChange={(e) => setForm({ ...form, offer_date: e.target.value })}
                dir="ltr"
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>חוות דעת</label>
              <input
                type="text"
                value={form.my_opinion}
                onChange={(e) => setForm({ ...form, my_opinion: e.target.value })}
                placeholder="רשמו כאן..."
              />
            </div>
          </div>
          <div className="form-group" style={{ margin: '0 0 12px 0' }}>
            <label>הערות</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="פרטים נוספים..."
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" style={{ fontSize: 13, padding: '5px 14px' }} onClick={() => setEditing(false)}>ביטול</button>
            <button className="btn btn-primary" style={{ fontSize: 13, padding: '5px 14px' }} onClick={handleSave} disabled={saving || !form.supplier_name.trim()}>
              {saving ? 'שומר...' : 'שמור'}
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <>
      <tr style={{ ...rowStyle, borderBottom: expanded ? 'none' : undefined }}>
        <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 14 }}>
          {quote.supplier_name}
          {quote.contact && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, marginTop: 1 }}>{quote.contact}</div>
          )}
        </td>
        <td style={{ padding: '10px 14px', fontSize: 14 }}>
          {quote.amount != null ? formatCurrency(quote.amount) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
        </td>
        <td style={{ padding: '10px 14px', fontSize: 14 }}>
          {quote.duration_days != null ? `${quote.duration_days} ימים` : <span style={{ color: 'var(--text-muted)' }}>—</span>}
        </td>
        <td style={{ padding: '10px 14px' }}>
          <Stars value={quote.reliability || 0} />
        </td>
        <td style={{ padding: '10px 14px' }}>
          <select
            value={quote.status || 'פתוחה'}
            onChange={(e) => handleStatusChange(e.target.value)}
            style={{
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              fontSize: 13,
              background: 'transparent',
              cursor: 'pointer',
              color: STATUS_STYLE[quote.status]?.color || 'var(--text)',
            }}
          >
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </td>
        <td style={{ padding: '10px 14px' }}>
          {(quote.my_opinion || quote.notes) && (
            <button
              className="btn btn-secondary"
              style={{ fontSize: 12, padding: '3px 10px' }}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? '▲' : '▼ פרטים'}
            </button>
          )}
        </td>
        <td style={{ padding: '10px 14px' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary" style={{ fontSize: 12, padding: '3px 10px' }} onClick={startEdit}>עריכה</button>
            {confirmDelete ? (
              <>
                <button className="btn btn-danger" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => onDelete(quote.id)}>בטוח?</button>
                <button className="btn btn-secondary" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => setConfirmDelete(false)}>לא</button>
              </>
            ) : (
              <button className="btn btn-danger" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => setConfirmDelete(true)}>מחק</button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr style={rowStyle}>
          <td colSpan={7} style={{ padding: '8px 14px 14px 14px', fontSize: 13 }}>
            {quote.my_opinion && (
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>חוות דעת: </span>
                {quote.my_opinion}
              </div>
            )}
            {quote.notes && (
              <div>
                <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>הערות: </span>
                {quote.notes}
              </div>
            )}
            {quote.offer_date && (
              <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 12 }}>
                תאריך הצעה: {new Date(quote.offer_date).toLocaleDateString('he-IL')}
              </div>
            )}
          </td>
        </tr>
      )}
      {toast && (
        <tr>
          <td colSpan={7} style={{ padding: '0 14px 8px 14px' }}>
            <div style={{
              padding: '8px 14px',
              borderRadius: 7,
              fontSize: 13,
              fontWeight: 500,
              background: toast.type === 'success' ? '#E1F5EE' : '#fef9c3',
              color: toast.type === 'success' ? '#065f46' : '#92400e',
              border: `1px solid ${toast.type === 'success' ? '#6ee7b7' : '#fbbf24'}`,
            }}>
              {toast.text}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function AddQuoteRow({ categoryId, onAdd, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!form.supplier_name.trim()) return
    setSaving(true)
    try {
      await onAdd({
        category_id: categoryId,
        supplier_name: form.supplier_name.trim(),
        amount: form.amount !== '' ? Number(form.amount) : null,
        duration_days: form.duration_days !== '' ? Number(form.duration_days) : null,
        reliability: form.reliability || null,
        contact: form.contact || null,
        offer_date: form.offer_date || null,
        my_opinion: form.my_opinion || null,
        notes: form.notes || null,
        status: form.status,
      })
      onCancel()
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr style={{ background: '#f0fdf4' }}>
      <td colSpan={7} style={{ padding: '14px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>שם ספק *</label>
            <input
              type="text"
              value={form.supplier_name}
              onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
              placeholder="שם החברה / איש הקשר"
              autoFocus
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>סכום (₪)</label>
            <input
              type="number"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0"
              dir="ltr"
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>זמן ביצוע (ימים)</label>
            <input
              type="number"
              min="0"
              value={form.duration_days}
              onChange={(e) => setForm({ ...form, duration_days: e.target.value })}
              placeholder="0"
              dir="ltr"
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>דירוג</label>
            <div style={{ paddingTop: 8 }}>
              <Stars value={form.reliability} onChange={(v) => setForm({ ...form, reliability: v })} />
            </div>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>סטטוס</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>פרטי קשר</label>
            <input
              type="text"
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              placeholder="טלפון / אימייל"
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>תאריך הצעה</label>
            <input
              type="date"
              value={form.offer_date}
              onChange={(e) => setForm({ ...form, offer_date: e.target.value })}
              dir="ltr"
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>חוות דעת</label>
            <input
              type="text"
              value={form.my_opinion}
              onChange={(e) => setForm({ ...form, my_opinion: e.target.value })}
              placeholder="רשמו כאן..."
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" style={{ fontSize: 13, padding: '5px 14px' }} onClick={onCancel}>ביטול</button>
          <button
            className="btn btn-primary"
            style={{ fontSize: 13, padding: '5px 14px' }}
            onClick={handleSubmit}
            disabled={saving || !form.supplier_name.trim()}
          >
            {saving ? 'שומר...' : 'הוסף ספק'}
          </button>
        </div>
      </td>
    </tr>
  )
}

function AddCategoryForm({ onAdd, onCancel }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('📋')
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onAdd({ name: name.trim(), icon })
      onCancel()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      gap: 10,
      padding: '12px 16px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      marginBottom: 16,
    }}>
      <div className="form-group" style={{ margin: 0, flex: '0 0 auto' }}>
        <label>אייקון</label>
        <select
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 18, width: 64 }}
        >
          {EMOJI_OPTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>
      <div className="form-group" style={{ margin: 0, flex: 1 }}>
        <label>שם קטגוריה</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
          placeholder="למשל: אינסטלטור"
          autoFocus
        />
      </div>
      <button className="btn btn-secondary" style={{ fontSize: 13, padding: '9px 14px', flexShrink: 0 }} onClick={onCancel}>ביטול</button>
      <button
        className="btn btn-primary"
        style={{ fontSize: 13, padding: '9px 14px', flexShrink: 0 }}
        onClick={handleSubmit}
        disabled={saving || !name.trim()}
      >
        {saving ? '...' : 'הוסף'}
      </button>
    </div>
  )
}

export default function Quotes({ quotes, quoteCategories, onAddCategory, onDeleteCategory, onAddQuote, onUpdateQuote, onDeleteQuote, onPaymentRequestAdded }) {
  const [activeCategory, setActiveCategory] = useState(null)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [showAddRow, setShowAddRow] = useState(false)
  const [deleteCatError, setDeleteCatError] = useState(null)
  const [search, setSearch] = useState('')

  // Default to first category
  const effectiveActive = activeCategory ?? quoteCategories[0]?.id ?? null

  const categoryQuotes = quotes.filter((q) => q.category_id === effectiveActive)

  const term = search.trim().toLowerCase()
  const visibleQuotes = term
    ? categoryQuotes.filter((q) =>
        [q.supplier_name, q.my_opinion, q.notes, q.contact]
          .some((f) => f && f.toLowerCase().includes(term))
      )
    : categoryQuotes

  async function handleDeleteCategory(id) {
    setDeleteCatError(null)
    try {
      await onDeleteCategory(id)
      if (effectiveActive === id) setActiveCategory(null)
    } catch (err) {
      setDeleteCatError(err.message || 'שגיאה במחיקת קטגוריה')
      setTimeout(() => setDeleteCatError(null), 4000)
    }
  }

  const activeObj = quoteCategories.find((c) => c.id === effectiveActive)

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>השוואת הצעות מחיר</h2>

      {/* Category tab bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {quoteCategories.map((cat) => (
          <button
            key={cat.id}
            className={`chip${effectiveActive === cat.id ? ' chip-active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, padding: '7px 16px' }}
            onClick={() => { setActiveCategory(cat.id); setShowAddRow(false); setSearch('') }}
          >
            <span>{cat.icon}</span>
            <span>{cat.name}</span>
            <span style={{ marginRight: 4, opacity: 0.55, fontSize: 12 }}>
              ({quotes.filter((q) => q.category_id === cat.id).length})
            </span>
          </button>
        ))}
        {!showAddCategory && (
          <button
            className="chip"
            style={{ fontSize: 14, padding: '7px 14px', color: 'var(--accent)', borderColor: 'var(--accent)' }}
            onClick={() => setShowAddCategory(true)}
          >
            ➕ קטגוריה חדשה
          </button>
        )}
      </div>

      {showAddCategory && (
        <AddCategoryForm
          onAdd={onAddCategory}
          onCancel={() => setShowAddCategory(false)}
        />
      )}

      {deleteCatError && (
        <div className="error-banner" style={{ marginBottom: 16 }}>{deleteCatError}</div>
      )}

      {effectiveActive == null ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', marginTop: 40 }}>
          הוסיפו קטגוריה ראשונה כדי להתחיל
        </p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Card header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              {activeObj?.icon} {activeObj?.name}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {!showAddRow && (
                <button className="btn btn-primary" style={{ fontSize: 13, padding: '6px 16px' }} onClick={() => setShowAddRow(true)}>
                  ＋ הוסף ספק
                </button>
              )}
              {categoryQuotes.length === 0 && (
                <button
                  className="btn btn-danger"
                  style={{ fontSize: 13, padding: '6px 14px' }}
                  onClick={() => handleDeleteCategory(effectiveActive)}
                >
                  מחק קטגוריה
                </button>
              )}
            </div>
          </div>

          {/* Search */}
          <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש ספק..."
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 14,
                fontFamily: 'inherit',
                background: 'var(--bg)',
                color: 'var(--text)',
                outline: 'none',
              }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }}
            />
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg)' }}>
                  {['שם ספק', 'סכום (₪)', 'זמן ביצוע', 'דירוג (★)', 'סטטוס', 'פרטים', 'פעולות'].map((h) => (
                    <th key={h} style={{
                      padding: '10px 14px',
                      textAlign: 'start',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      borderBottom: '1px solid var(--border)',
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {showAddRow && (
                  <AddQuoteRow
                    categoryId={effectiveActive}
                    onAdd={onAddQuote}
                    onCancel={() => setShowAddRow(false)}
                  />
                )}
                {categoryQuotes.length === 0 && !showAddRow ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '32px 14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                      אין ספקים עדיין. לחצו על "הוסף ספק" כדי להתחיל.
                    </td>
                  </tr>
                ) : visibleQuotes.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '32px 14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                      לא נמצאו תוצאות לחיפוש זה
                    </td>
                  </tr>
                ) : (
                  visibleQuotes.map((q) => (
                    <QuoteRow
                      key={q.id}
                      quote={q}
                      onUpdate={onUpdateQuote}
                      onDelete={onDeleteQuote}
                      onPaymentRequestAdded={onPaymentRequestAdded}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
