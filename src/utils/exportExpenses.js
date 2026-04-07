export function exportExpensesToCSV(expenses) {
  if (expenses.length === 0) return

  const headers = ['תאריך', 'תיאור', 'קטגוריה', 'סכום (₪)', 'הערות']

  const rows = [...expenses]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((e) => [
      e.date,
      e.description,
      e.category,
      Number(e.amount).toFixed(2),
      e.notes || '',
    ])

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  // UTF-8 BOM so Excel opens Hebrew correctly
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `הוצאות_בית_במושב_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
