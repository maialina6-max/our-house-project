import { useRef, useState } from 'react'
import { apiUploadDocument, apiAnalyzeDocument, apiAskDocument } from '../hooks/useAPI'

const CATEGORIES = ['היתר בנייה', 'חוזה', 'קבלה', 'שמאות', 'מסמך רשמי', 'דרישת תשלום', 'אחר']

function docIcon(fileType) {
  if (fileType === 'application/pdf') return '📕'
  if (fileType && fileType.startsWith('image/')) return '🖼️'
  return '📎'
}

// ── Rich analysis panel (Phase 1) ──────────────────────────────────────────────

function AnalysisPanel({ doc }) {
  const parties = doc.ai_parties || []
  const dates = doc.ai_important_dates || []
  const obligations = doc.ai_obligations || []
  const questions = doc.ai_lawyer_questions || []
  const hasRichData = parties.length > 0 || dates.length > 0 || obligations.length > 0 || questions.length > 0

  return (
    <div style={{
      fontSize: 13,
      color: 'var(--text)',
      background: 'var(--surface)',
      borderRadius: 6,
      padding: '10px 14px',
      borderRight: '3px solid var(--primary)',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {doc.ai_summary && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 3, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>סיכום</div>
          <div>{doc.ai_summary}</div>
        </div>
      )}

      {hasRichData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {parties.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 3, color: 'var(--text-muted)', fontSize: 11 }}>צדדים</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {parties.map((p, i) => (
                  <li key={i}>• {p.name} — <span style={{ color: 'var(--text-muted)' }}>{p.role}</span></li>
                ))}
              </ul>
            </div>
          )}

          {dates.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 3, color: 'var(--text-muted)', fontSize: 11 }}>תאריכים חשובים</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {dates.map((d, i) => (
                  <li key={i}>• {d.label}{d.date ? `: ${new Date(d.date).toLocaleDateString('he-IL')}` : ''}</li>
                ))}
              </ul>
            </div>
          )}

          {obligations.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 3, color: 'var(--text-muted)', fontSize: 11 }}>התחייבויות</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {obligations.map((o, i) => (
                  <li key={i}>• {o}</li>
                ))}
              </ul>
            </div>
          )}

          {questions.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 3, color: 'var(--text-muted)', fontSize: 11 }}>שאלות לעורך הדין</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {questions.map((q, i) => (
                  <li key={i}>• {q}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Mini chat per document (Phase 2) ──────────────────────────────────────────

function DocChat({ docId, apiKey }) {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState([]) // [{ question, answer }]
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleAsk() {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setError(null)
    setLoading(true)
    try {
      const { answer } = await apiAskDocument(docId, q, apiKey)
      setHistory((prev) => [...prev, { question: q, answer }])
    } catch (err) {
      setError(err.message || 'שגיאה בשאלה')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '10px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      fontSize: 13,
    }}>
      {history.map((item, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>שאלה: {item.question}</div>
          <div style={{ borderRight: '2px solid var(--primary)', paddingRight: 8 }}>{item.answer}</div>
        </div>
      ))}

      {error && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk() } }}
          placeholder="שאל שאלה על מסמך זה..."
          disabled={loading}
          style={{ flex: 1, fontSize: 13 }}
        />
        <button
          className="btn btn-primary"
          style={{ fontSize: 13, padding: '5px 14px' }}
          onClick={handleAsk}
          disabled={loading || !input.trim()}
        >
          {loading ? '...' : 'שאל'}
        </button>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Documents({ documents, onAdd, onDelete, onUpdate, onPaymentRequestCreated, apiKey }) {
  const fileInputRef = useRef(null)
  const [activeFilter, setActiveFilter] = useState('הכל')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [deleteError, setDeleteError] = useState(null)
  const [deletingIds, setDeletingIds] = useState(new Set())
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [analyzingIds, setAnalyzingIds] = useState(new Set())
  const [analyzeErrors, setAnalyzeErrors] = useState({})      // id → error string
  const [expandedIds, setExpandedIds] = useState(new Set())   // analysis panel open
  const [chatIds, setChatIds] = useState(new Set())           // mini-chat open

  async function handleAnalyze(id) {
    if (!apiKey) return
    setAnalyzingIds((prev) => new Set(prev).add(id))
    setAnalyzeErrors((prev) => { const n = { ...prev }; delete n[id]; return n })
    try {
      const analysis = await apiAnalyzeDocument(id, apiKey)
      console.log('[analyze] response for doc', id, analysis)
      if (analysis.document) {
        console.log('[analyze] document fields:', {
          status: analysis.document.status,
          category: analysis.document.category,
          ai_parties: analysis.document.ai_parties,
          ai_important_dates: analysis.document.ai_important_dates,
          ai_obligations: analysis.document.ai_obligations,
          ai_lawyer_questions: analysis.document.ai_lawyer_questions,
        })
        onUpdate(id, analysis.document)
        setExpandedIds((prev) => new Set(prev).add(id))
      }
      if (analysis.payment_request && onPaymentRequestCreated) {
        onPaymentRequestCreated(analysis.payment_request)
      }
    } catch (err) {
      console.error('AI analysis failed:', err)
      setAnalyzeErrors((prev) => ({ ...prev, [id]: err.message || 'שגיאה בניתוח' }))
    } finally {
      setAnalyzingIds((prev) => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  async function handleDelete(id) {
    setDeleteError(null)
    setDeletingIds((prev) => new Set(prev).add(id))
    try {
      await onDelete(id)
    } catch (err) {
      setDeleteError('המחיקה נכשלה: ' + (err.message || 'שגיאת שרת'))
    } finally {
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  function showDuplicateWarning(existing) {
    setDuplicateWarning(existing)
    setTimeout(() => setDuplicateWarning(null), 5000)
  }

  function toggleExpanded(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleChat(id) {
    setChatIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleFiles(files) {
    setUploading(true)
    setUploadError(null)
    for (const file of files) {
      try {
        const result = await apiUploadDocument(file)
        if (result.duplicate) {
          showDuplicateWarning(result.existing_document)
          continue
        }
        const doc = result
        onAdd(doc)
        if (apiKey && (file.type === 'application/pdf' || file.type.startsWith('image/'))) {
          await handleAnalyze(doc.id)
        }
      } catch (err) {
        setUploadError('ההעלאה נכשלה, נסו שוב.')
        console.error(err)
      }
    }
    setUploading(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    handleFiles(Array.from(e.dataTransfer.files))
  }

  const usedCategories = [...new Set(documents.map((d) => d.category))]
  const filterOptions = ['הכל', ...CATEGORIES.filter((c) => usedCategories.includes(c))]

  const visible = activeFilter === 'הכל'
    ? documents
    : documents.filter((d) => d.category === activeFilter)

  const sorted = [...visible].sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at))

  return (
    <div>
      <div
        className="upload-area"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !uploading && fileInputRef.current.click()}
        style={{ cursor: uploading ? 'wait' : 'pointer' }}
      >
        <label className="upload-label">
          <span className="upload-icon">📤</span>
          <span className="upload-text">
            {uploading ? 'מעלה...' : 'גרור קבצים לכאן או לחץ להעלאה'}
          </span>
          <span className="upload-hint">PDF, תמונות — עד 20MB לקובץ</span>
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,image/*"
          multiple
          onChange={(e) => handleFiles(Array.from(e.target.files))}
          style={{ display: 'none' }}
        />
      </div>

      {uploadError && (
        <p style={{ color: 'var(--danger)', fontSize: 13, margin: '8px 0' }}>{uploadError}</p>
      )}

      {deleteError && (
        <p style={{ color: 'var(--danger)', fontSize: 13, margin: '8px 0' }}>{deleteError}</p>
      )}

      {duplicateWarning && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: 8,
          padding: '10px 14px',
          margin: '8px 0',
          fontSize: 13,
          color: '#92400e',
          gap: 12,
        }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>⚠️ המסמך כבר קיים במערכת</div>
            <div>"{duplicateWarning.file_name}"</div>
            <div>הועלה בתאריך {new Date(duplicateWarning.uploaded_at).toLocaleDateString('he-IL')}</div>
          </div>
          <button
            onClick={() => setDuplicateWarning(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#92400e', lineHeight: 1, padding: 0, flexShrink: 0 }}
            aria-label="סגור"
          >✕</button>
        </div>
      )}

      {!apiKey && (
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '8px 0', textAlign: 'center' }}>
          ⚠️ הזן מפתח API בהגדרות כדי לאפשר ניתוח אוטומטי של מסמכים
        </p>
      )}

      {documents.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          עוד לא העליתם מסמכים. גררו קבצים לכאן או לחצו להעלאה.
        </p>
      ) : (
        <>
          {filterOptions.length > 2 && (
            <div className="quick-chips" style={{ marginBottom: 16 }}>
              {filterOptions.map((f) => (
                <button
                  key={f}
                  className={`chip${activeFilter === f ? ' chip-active' : ''}`}
                  onClick={() => setActiveFilter(f)}
                >
                  {f}
                  {f !== 'הכל' && (
                    <span style={{ marginRight: 4, opacity: 0.6 }}>
                      ({documents.filter((d) => d.category === f).length})
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {sorted.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              אין מסמכים בקטגוריה זו.
            </p>
          ) : (
            <div className="doc-list">
              {sorted.map((doc) => {
                const isAnalyzed = doc.status === 'analyzed' && !analyzingIds.has(doc.id)
                const isExpanded = expandedIds.has(doc.id)
                const isChatOpen = chatIds.has(doc.id)

                return (
                  <div key={doc.id} className="doc-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                    {/* ── Header row ── */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="doc-icon">{docIcon(doc.file_type)}</span>
                      <div className="doc-info" style={{ flex: 1 }}>
                        <div className="doc-name">{doc.file_name}</div>
                        <div className="doc-meta">
                          <span>{new Date(doc.uploaded_at).toLocaleDateString('he-IL')}</span>
                          {analyzingIds.has(doc.id) && (
                            <span style={{ color: 'var(--primary)', fontStyle: 'italic' }}>מנתח...</span>
                          )}
                          {isAnalyzed && (
                            <span style={{ color: '#16a34a' }}>✓ נותח</span>
                          )}
                        </div>
                      </div>

                      {isAnalyzed && (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 12, padding: '4px 10px' }}
                          onClick={() => toggleExpanded(doc.id)}
                        >
                          {isExpanded ? '▲ סגור' : '▼ פרטי ניתוח'}
                        </button>
                      )}

                      {isAnalyzed && apiKey && (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 12, padding: '4px 10px' }}
                          onClick={() => toggleChat(doc.id)}
                        >
                          {isChatOpen ? '✕ סגור' : '💬 שאל'}
                        </button>
                      )}

                      {apiKey && (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 12, padding: '4px 10px' }}
                          onClick={() => handleAnalyze(doc.id)}
                          disabled={analyzingIds.has(doc.id)}
                        >
                          {analyzingIds.has(doc.id) ? 'מנתח...' : isAnalyzed ? 'נתח מחדש' : 'נתח מסמך'}
                        </button>
                      )}

                      <select
                        value={doc.category}
                        onChange={(e) => onUpdate(doc.id, { category: e.target.value })}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          fontSize: 13,
                          color: 'var(--text)',
                          background: 'var(--surface)',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>

                      <button
                        className="btn btn-danger"
                        onClick={() => handleDelete(doc.id)}
                        disabled={deletingIds.has(doc.id)}
                      >
                        {deletingIds.has(doc.id) ? '...' : 'מחק'}
                      </button>
                    </div>

                    {/* ── Per-doc analysis error ── */}
                    {analyzeErrors[doc.id] && (
                      <div style={{ fontSize: 12, color: 'var(--danger)' }}>
                        שגיאה בניתוח: {analyzeErrors[doc.id]}
                      </div>
                    )}

                    {/* ── Expandable analysis panel (Phase 1) ── */}
                    {isExpanded && <AnalysisPanel doc={doc} />}

                    {/* ── Mini chat (Phase 2) ── */}
                    {isChatOpen && <DocChat docId={doc.id} apiKey={apiKey} />}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
