import { useState, useEffect } from 'react'
import localforage from 'localforage'

export default function Settings({ setCurrentPage }) {
  const [settings, setSettings] = useState({
    autoTime: true,
    autoUTC: true,
    defaultEnvironment: 'terrestrial',
    language: 'en'
  })

  useEffect(() => {
    const loadSettings = async () => {
      const saved = await localforage.getItem('appSettings')
      if (saved) setSettings(saved)
    }
    loadSettings()
  }, [])

  const updateSetting = async (key, value) => {
    const updated = { ...settings, [key]: value }
    setSettings(updated)
    await localforage.setItem('appSettings', updated)
  }

  return (
    <div className="page-content">
      <button className="btn-back" onClick={() => setCurrentPage('home')}>← Back to Menu</button>

      <h2>Settings</h2>

      <div className="section">
        <h3>Auto-fill Settings</h3>
        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={settings.autoTime}
              onChange={(e) => updateSetting('autoTime', e.target.checked)}
            />
            Auto-fill current time
          </label>
          <p className="setting-description">Automatically fill time when opening new site entry</p>
        </div>

        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={settings.autoUTC}
              onChange={(e) => updateSetting('autoUTC', e.target.checked)}
            />
            Auto-detect UTC offset
          </label>
          <p className="setting-description">Detect timezone from device settings</p>
        </div>
      </div>

      <div className="section">
        <h3>Default Values</h3>
        <div className="setting-item">
          <label>Default Environment</label>
          <select
            value={settings.defaultEnvironment}
            onChange={(e) => updateSetting('defaultEnvironment', e.target.value)}
          >
            <option value="terrestrial">Terrestrial</option>
            <option value="aquatic">Aquatic</option>
          </select>
        </div>
      </div>

      <div className="section">
        <h3>App Version</h3>
        <p>Arctic Field Diary v1.0</p>
      </div>

      <div className="section danger-section">
        <h3>Danger Zone</h3>
        <button
          className="btn-danger"
          onClick={() => {
            if (window.confirm('Clear all data? This cannot be undone!')) {
              localforage.clear()
              alert('All data cleared')
              window.location.reload()
            }
          }}
        >
          🗑️ Clear All Data
        </button>
      </div>
    </div>
  )
}
