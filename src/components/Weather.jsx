import { useState } from 'react'
import { validateTemperature, validateWindSpeed } from '../utils/validation'

export default function Weather({ control, watch, setValue }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [tempError, setTempError] = useState(null)
  const [windError, setWindError] = useState(null)
  const data = watch()

  const weatherData = data.weather || {}

  const updateWeather = (field, value) => {
    setValue('weather', { ...weatherData, [field]: value })
  }

  return (
    <div className={`section ${!isExpanded ? 'collapsed' : ''}`}>
      <button
        className="section-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2>Weather Conditions</h2>
        <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
      </button>

      {isExpanded && (
        <div className="section-content">
          <button
            className="btn-sync-weather"
            onClick={() => {
              if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    const { latitude, longitude } = position.coords
                    alert(`Location detected: ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`)
                  },
                  (error) => {
                    alert('Enable location to sync weather from phone')
                  }
                )
              }
            }}
          >
            📍 Sync Weather from Phone
          </button>

          <div className="field-group">
            <label>Cloud Cover (%)</label>
            <input
              type="range"
              min="0"
              max="100"
              value={weatherData.cloudCover || 0}
              onChange={(e) => updateWeather('cloudCover', parseInt(e.target.value))}
            />
            <span className="value-display">{weatherData.cloudCover || 0}%</span>
          </div>

          <div className="field-group">
            <label>Precipitation</label>
            <select
              value={weatherData.precipitation || 'none'}
              onChange={(e) => updateWeather('precipitation', e.target.value)}
            >
              <option value="none">None</option>
              <option value="drizzle">Drizzle</option>
              <option value="light">Light Rain</option>
              <option value="moderate">Moderate Rain</option>
              <option value="heavy">Heavy Rain</option>
              <option value="snow">Snow</option>
              <option value="sleet">Sleet</option>
            </select>
          </div>

          <div className="field-group">
            <label>Wind Speed (m/s)</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                min="0"
                step="0.5"
                value={weatherData.windSpeed || ''}
                onChange={(e) => {
                  const value = e.target.value
                  const validation = validateWindSpeed(value)
                  setWindError(validation.valid ? null : validation.message)
                  updateWeather('windSpeed', parseFloat(value) || '')
                }}
                placeholder="e.g., 5.2"
                style={{
                  flex: 1,
                  borderColor: windError ? '#d32f2f' : undefined
                }}
              />
              <span style={{ fontWeight: 600, minWidth: '40px' }}>m/s</span>
            </div>
            {windError && (
              <small style={{ color: '#d32f2f', marginTop: '4px', display: 'block' }}>
                ⚠️ {windError}
              </small>
            )}
          </div>

          <div className="field-group">
            <label>Wind Direction</label>
            <select
              value={weatherData.windDirection || 'calm'}
              onChange={(e) => updateWeather('windDirection', e.target.value)}
            >
              <option value="calm">Calm</option>
              <option value="N">North</option>
              <option value="NE">Northeast</option>
              <option value="E">East</option>
              <option value="SE">Southeast</option>
              <option value="S">South</option>
              <option value="SW">Southwest</option>
              <option value="W">West</option>
              <option value="NW">Northwest</option>
            </select>
          </div>

          <div className="field-group">
            <label>Air Temperature (°C)</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                placeholder="e.g., 5.3"
                style={{
                  flex: 1,
                  borderColor: tempError ? '#d32f2f' : undefined
                }}
              />
              <span style={{ fontWeight: 600, minWidth: '40px' }}>°C</span>
            </div>
            {tempError && (
              <small style={{ color: '#d32f2f', marginTop: '4px', display: 'block' }}>
                ⚠️ {tempError}
              </small>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
