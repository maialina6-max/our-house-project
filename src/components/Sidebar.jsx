const NAV_ITEMS = [
  { id: 'dashboard', label: 'בית', icon: '🏠' },
  { id: 'documents', label: 'מסמכים', icon: '📄' },
  { id: 'expenses', label: 'הוצאות', icon: '💰' },
  { id: 'quotes', label: 'הצעות מחיר', icon: '📊' },
  { id: 'chat', label: 'שאל את הבית', icon: '🤖' },
]

export default function Sidebar({ activeTab, onTabChange }) {
  return (
    <aside className="sidebar">
      <nav>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}
