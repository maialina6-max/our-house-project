import { useState, useRef, useEffect } from 'react'
import { useClaudeAPI } from '../hooks/useClaudeAPI'

const QUICK_QUESTIONS = [
  'מה סה"כ ההוצאות שלנו עד היום?',
  'אילו מסמכים יש לנו?',
  'מה ההוצאה הגדולה ביותר?',
  'סכם את פרויקט הבנייה',
  'אילו קטגוריות של הוצאות יש לנו?',
]

export default function Chat({ documents, expenses, apiKey }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [chipsVisible, setChipsVisible] = useState(true)
  const messagesEndRef = useRef(null)
  const { sendMessage, isLoading, error } = useClaudeAPI(apiKey)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  async function handleSend(text) {
    const userText = (text || input).trim()
    if (!userText || isLoading) return

    setChipsVisible(false)

    const userMsg = { role: 'user', content: userText, timestamp: new Date().toISOString() }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')

    try {
      const reply = await sendMessage(updatedMessages, documents, expenses)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply, timestamp: new Date().toISOString() },
      ])
    } catch {
      // error already set in hook
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px - 56px)' }}>
      {!apiKey && (
        <div className="warning-banner">
          ⚠️ לא הוגדר מפתח API. פתח את ⚙️ הגדרות כדי להזין את מפתח Claude API שלך.
        </div>
      )}

      <div className="messages-area">
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, marginTop: 32, lineHeight: 1.8 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🏠</div>
            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>שלום! אני כאן לעזור לכם עם פרויקט הבית במושב.</div>
            <div>אפשר לשאול אותי על הוצאות, מסמכים, שלבי התהליך, או כל שאלה אחרת.</div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div className="message-bubble">{msg.content}</div>
            <span className="message-time">
              {new Date(msg.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        {isLoading && (
          <div className="message assistant">
            <div className="message-bubble" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
              חושב...
            </div>
          </div>
        )}
        {error && <div className="error-banner">אירעה שגיאה בחיבור. נסו שוב.</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        {chipsVisible && (
          <div className="quick-chips">
            {QUICK_QUESTIONS.map((q) => (
              <button key={q} className="chip" onClick={() => handleSend(q)} disabled={isLoading || !apiKey}>
                {q}
              </button>
            ))}
          </div>
        )}
        <div className="chat-input-row">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="שאל שאלה על הפרויקט..."
            disabled={isLoading || !apiKey}
          />
          <button
            className="btn btn-primary"
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim() || !apiKey}
          >
            שלח
          </button>
        </div>
      </div>
    </div>
  )
}
