import { useState } from 'react'
import './SettingsPanel.css'

const MODELS = [
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite (fastest)' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (most accurate)' },
]

function SettingsPanel({ theme, onThemeChange, model, onModelChange }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="settings-panel">
      <button
        className="settings-gear"
        aria-label="Settings"
        onClick={() => setOpen((v) => !v)}
      >
        ⚙
      </button>

      {open && (
        <>
          <div className="settings-backdrop" onClick={() => setOpen(false)} />
          <div className="settings-box">
            <h3>Settings</h3>

            <div className="settings-row">
              <span>Theme</span>
              <div className="theme-toggle">
                <button
                  className={theme === 'light' ? 'active' : ''}
                  onClick={() => onThemeChange('light')}
                >
                  Light
                </button>
                <button
                  className={theme === 'dark' ? 'active' : ''}
                  onClick={() => onThemeChange('dark')}
                >
                  Dark
                </button>
              </div>
            </div>

            <div className="settings-row">
              <span>Marking model</span>
              <select value={model} onChange={(e) => onModelChange(e.target.value)}>
                {MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default SettingsPanel
