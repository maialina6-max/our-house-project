import { useState } from 'react'
import { formatCurrency } from '../utils/formatCurrency'

export default function MetricsBar({ documents, expenses, apiKey, onSaveApiKey }) {
  const [showSettings, setShowSettings] = useState(false)
  const [keyInput, setKeyInput] = useState(apiKey || '')

  const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  function handleSave() {
    onSaveApiKey(keyInput.trim())
    setShowSettings(false)
  }

  return (
    <>
      <header className="metrics-bar">
        <span className="app-title">🏠 בית במושב</span>

        <div className="metric-item">
          <span className="metric-value">{expenses.length > 0 ? formatCurrency(totalSpent) : '—'}</span>
          <span className="metric-label">סה"כ הוצאות</span>
        </div>

        <div className="metric-item">
          <span className="metric-value">{expenses.length}</span>
          <span className="metric-label">הוצאות</span>
        </div>

        <div className="metric-item">
          <span className="metric-value">{documents.length}</span>
          <span className="metric-label">מסמכים</span>
        </div>

        <button className="settings-btn" onClick={() => setShowSettings(true)} title="הגדרות">
          ⚙️
        </button>
      </header>

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">⚙️ הגדרות</div>
            <div className="form-group">
              <label>מפתח API של Claude</label>
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="sk-ant-..."
                dir="ltr"
              />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
              המפתח נשמר בדפדפן בלבד ואינו נשלח לשום שרת מלבד Anthropic.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowSettings(false)}>ביטול</button>
              <button className="btn btn-primary" onClick={handleSave}>שמור</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
