import { useState } from 'react'
import { validateTemperature, validateWindSpeed } from '../utils/validation'

export default function Weather({ control, watch, setValue, previousEntry, bluetoothReading, bluetoothError, startBluetoothRead }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [tempError, setTempError] = useState(null)
  const [windError, setWindError] = useState(null)
  const data = watch()
  const weatherData = data.weather || {}

  const copyFromPreviousEntry = () => {
    if (previousEntry?.weather) {
      setValue('weather', previousEntry.weather)
      alert('✓ Weather copied from previous entry')
    } else {
      alert('❌ No previous weather data available')
    }
  }

  const updateWeather = (field, value) => {
    const currentWeather = data.weather || {}
    setValue('weather', { ...currentWeather, [field]: value })
  }

  return (
    <div className={`section ${!isExpanded ? 'collapsed' : ''}`}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          className="section-header"
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ flex: 1 }}
        >
          <h2>Weather Conditions</h2>
          <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
        </button>
        <div style={{ display: 'flex', gap: '6px', margin: '10px 0 10px 0' }}>
          {previousEntry?.weather && (
            <button onClick={copyFromPreviousEntry} className="copy-button" style={{ padding: '8px 12px', fontSize: '12px' }}>
              📋 Copy
            </button>
          )}
          {startBluetoothRead && (
            <button
              type="button"
              onClick={startBluetoothRead}
              disabled={bluetoothReading}
              style={{ padding: '8px 12px', backgroundColor: bluetoothReading ? '#FFC107' : 'var(--primary-color)', color: bluetoothReading ? '#000' : 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: bluetoothReading ? 'wait' : 'pointer', fontSize: '12px' }}
            >
              📡 {bluetoothReading ? 'Reading...' : 'Read Sensor'}
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="section-content">
          {bluetoothError && (
            <div style={{ padding: '8px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px', fontSize: '12px', marginBottom: '12px' }}>
              {bluetoothError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div className="field-group">
              <label style={{ fontSize: '12px' }}>Cloud Cover (%)</label>
              <input
                type="range"
                min="0"
                max="100"
                value={weatherData.cloudCover || 0}
                onChange={(e) => updateWeather('cloudCover', parseInt(e.target.value))}
                style={{ marginBottom: '4px' }}
              />
              <span className="value-display" style={{ fontSize: '12px', display: 'block', textAlign: 'center' }}>{weatherData.cloudCover || 0}%</span>
            </div>

            <div className="field-group">
              <label style={{ fontSize: '12px' }}>Precipitation</label>
              <select
                value={weatherData.precipitation || 'none'}
                onChange={(e) => updateWeather('precipitation', e.target.value)}
                style={{ fontSize: '13px', padding: '6px 4px' }}
              >
                <option value="none">None</option>
                <option value="drizzle">Drizzle</option>
                <option value="light">Light</option>
                <option value="moderate">Moderate</option>
                <option value="heavy">Heavy</option>
                <option value="snow">Snow</option>
                <option value="sleet">Sleet</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div className="field-group">
              <label style={{ fontSize: '12px' }}>Air Temp (°C)</label>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input
                  type="number"
                  step="0.1"
                  value={weatherData.temperature || ''}
                  onChange={(e) => {
                    const value = e.target.value
                    const validation = validateTemperature(value)
                    setTempError(validation.valid ? null : validation.message)
                    updateWeather('temperature', parseFloat(value) || '')
                  }}
                  placeholder="e.g., 8.3"
                  style={{
                    flex: 1,
                    borderColor: tempError ? '#d32f2f' : undefined,
                    padding: '6px 4px',
                    fontSize: '13px'
                  }}
                />
                <span style={{ fontWeight: 600, fontSize: '12px', minWidth: '24px' }}>°C</span>
              </div>
              {tempError && (
                <small style={{ color: '#d32f2f', marginTop: '2px', display: 'block', fontSize: '11px' }}>
                  ⚠️ {tempError}
                </small>
              )}
            </div>

            <div className="field-group">
              <label style={{ fontSize: '12px' }}>Air Humidity (%)</label>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={weatherData.humidity || ''}
                  onChange={(e) => updateWeather('humidity', e.target.value === '' ? '' : parseInt(e.target.value))}
                  placeholder="0-100"
                  style={{
                    flex: 1,
                    padding: '6px 4px',
                    fontSize: '13px'
                  }}
                />
                <span style={{ fontWeight: 600, fontSize: '12px', minWidth: '16px' }}>%</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div className="field-group">
              <label style={{ fontSize: '12px' }}>Wind Speed (m/s)</label>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={weatherData.windSpeed || ''}
                  onChange={(e) => {
                    const value = e.target.value
                    const validation = validateWindSpeed(value)
                    setWindError(validation.valid ? null : validation.message)
                    updateWeather('windSpeed', value === '' ? '' : parseFloat(value))
                  }}
                  placeholder="e.g., 5.2"
                  style={{
                    flex: 1,
                    borderColor: windError ? '#d32f2f' : undefined,
                    padding: '6px 4px',
                    fontSize: '13px'
                  }}
                />
                <span style={{ fontWeight: 600, fontSize: '12px', minWidth: '32px' }}>m/s</span>
              </div>
              {windError && (
                <small style={{ color: '#d32f2f', marginTop: '2px', display: 'block', fontSize: '11px' }}>
                  ⚠️ {windError}
                </small>
              )}
            </div>

            <div></div>
          </div>

          <div className="field-group">
            <label>Wind Direction</label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '6px',
              marginBottom: '8px'
            }}>
              {[
                { value: 'calm', label: '⊗ Calm' },
                { value: 'N', label: '↑ N' },
                { value: 'NE', label: '↗ NE' },
                { value: 'E', label: '→ E' },
                { value: 'SE', label: '↘ SE' },
                { value: 'S', label: '↓ S' },
                { value: 'SW', label: '↙ SW' },
                { value: 'W', label: '← W' },
                { value: 'NW', label: '↖ NW' }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateWeather('windDirection', option.value)}
                  style={{
                    padding: '8px 6px',
                    backgroundColor: weatherData.windDirection === option.value ? 'var(--primary-color)' : 'var(--bg-secondary)',
                    color: weatherData.windDirection === option.value ? 'white' : 'var(--text-primary)',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                    transition: 'all 0.2s'
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
