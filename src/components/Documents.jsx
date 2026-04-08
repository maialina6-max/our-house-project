import { useRef, useState } from 'react'
import { apiUploadDocument } from '../hooks/useAPI'

const CATEGORIES = ['היתר בנייה', 'חוזה', 'קבלה', 'מסמך רשמי', 'תכנית', 'אחר']

function docIcon(fileType) {
  if (fileType === 'application/pdf') return '📕'
  if (fileType && fileType.startsWith('image/')) return '🖼️'
  return '📎'
}

export default function Documents({ documents, onAdd, onDelete, onUpdate }) {
  const fileInputRef = useRef(null)
  const [activeFilter, setActiveFilter] = useState('הכל')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  async function handleFiles(files) {
    setUploading(true)
    setUploadError(null)
    for (const file of files) {
      try {
        const doc = await apiUploadDocument(file)
        onAdd(doc)
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
                  <span className="doc-icon">{docIcon(doc.file_type)}</span>
                  <div className="doc-info">
                    <div className="doc-name">{doc.file_name}</div>
                    <div className="doc-meta">
                      <span>{new Date(doc.uploaded_at).toLocaleDateString('he-IL')}</span>
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
