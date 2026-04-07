import { useRef, useState } from 'react'
import { formatFileSize } from '../utils/formatCurrency'

const CATEGORIES = ['היתר בנייה', 'חוזה', 'קבלה', 'מסמך רשמי', 'תכנית', 'אחר']

function docIcon(type) {
  if (type === 'application/pdf') return '📕'
  if (type.startsWith('image/')) return '🖼️'
  return '📎'
}

export default function Documents({ documents, onAdd, onDelete, onUpdate }) {
  const fileInputRef = useRef(null)
  const [activeFilter, setActiveFilter] = useState('הכל')

  function handleFiles(files) {
    for (const file of files) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const base64 = e.target.result.split(',')[1]
        onAdd({
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type || 'application/octet-stream',
          category: 'אחר',
          size: file.size,
          uploadedAt: new Date().toISOString(),
          data: base64,
        })
      }
      reader.readAsDataURL(file)
    }
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

  const sorted = [...visible].sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))

  return (
    <div>
      <div
        className="upload-area"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current.click()}
      >
        <label className="upload-label">
          <span className="upload-icon">📤</span>
          <span className="upload-text">גרור קבצים לכאן או לחץ להעלאה</span>
          <span className="upload-hint">PDF, תמונות — עד 5MB לקובץ</span>
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
              {sorted.map((doc) => (
                <div key={doc.id} className="doc-item">
                  <span className="doc-icon">{docIcon(doc.type)}</span>
                  <div className="doc-info">
                    <div className="doc-name">{doc.name}</div>
                    <div className="doc-meta">
                      <span>{formatFileSize(doc.size)}</span>
                      <span>{new Date(doc.uploadedAt).toLocaleDateString('he-IL')}</span>
                    </div>
                  </div>
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
                  <button className="btn btn-danger" onClick={() => onDelete(doc.id)}>מחק</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
