const BASE = 'http://localhost:3001'

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, options)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `שגיאת שרת ${res.status}`)
  }
  return res.json()
}

// ── Documents ──────────────────────────────────────────────────────────────────

export function apiGetDocuments() {
  return request('/api/documents')
}

export async function apiUploadDocument(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/api/documents/upload`, { method: 'POST', body: form })
  const body = await res.json().catch(() => ({}))
  // Return 409 body as-is (duplicate: true) instead of throwing
  if (res.status === 409) return body
  if (!res.ok) throw new Error(body.error || `שגיאת שרת ${res.status}`)
  return body
}

export function apiAnalyzeDocument(id, apiKey) {
  return request(`/api/documents/${id}/analyze`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
  })
}

export function apiUpdateDocument(id, data) {
  return request(`/api/documents/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function apiDeleteDocument(id) {
  return request(`/api/documents/${id}`, { method: 'DELETE' })
}

// Returns { base64: string, type: string } — used by Chat to send to Claude API
export async function apiGetDocumentContent(id) {
  const res = await fetch(`${BASE}/api/documents/${id}/content`)
  if (!res.ok) throw new Error('שגיאה בטעינת תוכן המסמך')
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ base64: reader.result.split(',')[1], type: blob.type })
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// ── Expenses ───────────────────────────────────────────────────────────────────

export function apiGetExpenses() {
  return request('/api/expenses')
}

export function apiAddExpense(expense) {
  return request('/api/expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expense),
  })
}

export function apiUpdateExpense(id, data) {
  return request(`/api/expenses/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function apiDeleteExpense(id) {
  return request(`/api/expenses/${id}`, { method: 'DELETE' })
}

// ── Payment Requests ───────────────────────────────────────────────────────────

export function apiGetPaymentRequests() {
  return request('/api/payment-requests')
}

export function apiPayPaymentRequest(id, paid_at) {
  return request(`/api/payment-requests/${id}/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paid_at }),
  })
}
