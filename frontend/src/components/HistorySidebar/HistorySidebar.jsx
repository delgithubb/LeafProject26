import { useState } from 'react'
import './HistorySidebar.css'

function HistorySidebar({ questions, activeIndex, savedIds, onSelect }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={`history-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <button className="history-toggle" onClick={() => setCollapsed((c) => !c)}>
        {collapsed ? '›' : '‹'}
      </button>

      {!collapsed && (
        <ul className="history-list">
          {questions.map((q, i) => (
            <li key={q.id}>
              <button
                className={`history-item ${i === activeIndex ? 'active' : ''}`}
                onClick={() => onSelect(i)}
              >
                <span>Q{i + 1}</span>
                <span className="history-topic">{q.topic}</span>
                {savedIds.has(q.id) && <span className="history-check">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}

export default HistorySidebar
