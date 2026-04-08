import './App.css'
import { useState, useEffect } from 'react'
import MetricsBar from './components/MetricsBar'
import Sidebar from './components/Sidebar'
import Documents from './components/Documents'
import Expenses from './components/Expenses'
import Chat from './components/Chat'
import { formatCurrency } from './utils/formatCurrency'
import {
  apiGetDocuments, apiDeleteDocument, apiUpdateDocument,
  apiGetExpenses, apiAddExpense, apiDeleteExpense, apiUpdateExpense,
  apiGetPaymentRequests, apiPayPaymentRequest,
} from './hooks/useAPI'

function Dashboard({ documents, expenses, paymentRequests, onTabChange }) {
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const pendingCount = (paymentRequests || []).filter((pr) => pr.status === 'pending').length
  const recentExpenses = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5)
  const recentDocs = [...documents].sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at)).slice(0, 5)

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>סקירה כללית</h2>
      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-value">{formatCurrency(total)}</div>
          <div className="stat-label">סה"כ הוצאות</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{expenses.length}</div>
          <div className="stat-label">פעולות רשומות</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{documents.length}</div>
          <div className="stat-label">מסמכים</div>
        </div>
        {pendingCount > 0 && (
          <div className="stat-card" style={{ borderColor: '#ef4444', cursor: 'pointer' }} onClick={() => onTabChange('expenses')}>
            <div className="stat-value" style={{ color: '#ef4444' }}>{pendingCount}</div>
            <div className="stat-label">דרישות לתשלום</div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <div className="card-title">הוצאות אחרונות</div>
          {recentExpenses.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>אין הוצאות עדיין</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentExpenses.map((e) => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span>{e.description}</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(e.amount)}</span>
                </div>
              ))}
            </div>
          )}
          <button
            className="btn btn-secondary"
            style={{ marginTop: 14, width: '100%' }}
            onClick={() => onTabChange('expenses')}
          >
            כל ההוצאות ←
          </button>
        </div>

        <div className="card">
          <div className="card-title">מסמכים אחרונים</div>
          {recentDocs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>אין מסמכים עדיין</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentDocs.map((d) => (
                <div key={d.id} style={{ fontSize: 14 }}>
                  <span className="badge" style={{ marginInlineEnd: 8 }}>{d.category}</span>
                  {d.file_name}
                </div>
              ))}
            </div>
          )}
          <button
            className="btn btn-secondary"
            style={{ marginTop: 14, width: '100%' }}
            onClick={() => onTabChange('documents')}
          >
            כל המסמכים ←
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [documents, setDocuments] = useState([])
  const [expenses, setExpenses] = useState([])
  const [paymentRequests, setPaymentRequests] = useState([])
  const [apiKey, setApiKeyState] = useState(() => localStorage.getItem('bayit_api_key') || '')

  useEffect(() => {
    apiGetDocuments().then(setDocuments).catch(console.error)
    apiGetExpenses().then(setExpenses).catch(console.error)
    apiGetPaymentRequests().then(setPaymentRequests).catch(console.error)
  }, [])

  function saveApiKey(key) {
    setApiKeyState(key)
    localStorage.setItem('bayit_api_key', key)
  }

  // Documents
  function addDocument(doc) {
    setDocuments((prev) => [doc, ...prev])
  }

  function deleteDocument(id) {
    return apiDeleteDocument(id)
      .then(() => setDocuments((prev) => prev.filter((d) => d.id !== id)))
  }

  function updateDocument(id, data) {
    // data may be a full document object (from analyze) or a partial update
    if (data && data.id) {
      // Full document object returned from analyze — replace in state directly
      setDocuments((prev) => prev.map((d) => (d.id === id ? data : d)))
    } else {
      apiUpdateDocument(id, data)
        .then((updated) => setDocuments((prev) => prev.map((d) => (d.id === id ? updated : d))))
        .catch(console.error)
    }
  }

  function handlePaymentRequestCreated(pr) {
    setPaymentRequests((prev) => [pr, ...prev])
  }

  // Expenses
  function addExpense(expense) {
    apiAddExpense(expense)
      .then((saved) => setExpenses((prev) => [saved, ...prev]))
      .catch(console.error)
  }

  function deleteExpense(id) {
    apiDeleteExpense(id)
      .then(() => setExpenses((prev) => prev.filter((e) => e.id !== id)))
      .catch(console.error)
  }

  function updateExpense(id, data) {
    apiUpdateExpense(id, data)
      .then((updated) => setExpenses((prev) => prev.map((e) => (e.id === id ? updated : e))))
      .catch(console.error)
  }

  // Payment requests
  async function payPaymentRequest(id, paid_at) {
    const result = await apiPayPaymentRequest(id, paid_at)
    setPaymentRequests((prev) => prev.map((pr) => (pr.id === id ? result.payment_request : pr)))
    if (result.expense) {
      setExpenses((prev) => [result.expense, ...prev])
    }
  }

  function renderContent() {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard documents={documents} expenses={expenses} paymentRequests={paymentRequests} onTabChange={setActiveTab} />
      case 'documents':
        return (
          <Documents
            documents={documents}
            onAdd={addDocument}
            onDelete={deleteDocument}
            onUpdate={updateDocument}
            onPaymentRequestCreated={handlePaymentRequestCreated}
            apiKey={apiKey}
          />
        )
      case 'expenses':
        return (
          <Expenses
            expenses={expenses}
            paymentRequests={paymentRequests}
            onAdd={addExpense}
            onDelete={deleteExpense}
            onUpdate={updateExpense}
            onPayRequest={payPaymentRequest}
          />
        )
      case 'chat':
        return <Chat documents={documents} expenses={expenses} apiKey={apiKey} />
      default:
        return null
    }
  }

  return (
    <div className="app-layout">
      <MetricsBar
        documents={documents}
        expenses={expenses}
        apiKey={apiKey}
        onSaveApiKey={saveApiKey}
      />
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="main-content">
        {renderContent()}
      </main>
    </div>
  )
}
