import { useState, useEffect } from 'react'
import { validateCoordinates, validateSiteNumber } from '../utils/validation'

const LANDSCAPE_DEFAULTS = ['RTS', 'Polygon', 'Trench', 'Shore', 'Pond', 'Hummock', 'Palsa', 'Thermokarst', 'Degraded', 'Wet Sedge', 'Dry Moss', 'Mixed']
const DISTURBANCE_OPTIONS = ['None', 'Thermokarst', 'Solifluction', 'Erosion', 'Trampling', 'Other']

export default function QuickEntry({ control, watch, setValue, onSave, onBack, allEntries }) {
  const [landscapeSuggestions, setLandscapeSuggestions] = useState([])
  const [allLandscapes, setAllLandscapes] = useState(LANDSCAPE_DEFAULTS)
  const [isCollectingGPS, setIsCollectingGPS] = useState(false)
  const [gpsStatus, setGpsStatus] = useState('')
  const [gpsProgress, setGpsProgress] = useState(0)
  const data = watch()

  const shortVegData = data.vegetationShort || {}
  const vegetationCategories = [
    'Shrubs', 'Dwarf Shrubs', 'Grass', 'Sedges',
    'Green Mosses', 'Sphagnum Mosses', 'Brown Mosses',
    'Lichens', 'Bare Peat', 'Litter Standing Dead'
  ]

  useEffect(() => {
    const now = new Date()
    if (!data.localTime) {
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      setValue('localTime', `${hours}:${minutes}`)
    }
    if (!data.date) {
      setValue('date', new Date().toISOString().split('T')[0])
    }
  }, [])

  const getGPSCoordinates = async () => {
    if (!('geolocation' in navigator)) {
      alert('❌ Geolocation not supported')
      return
    }
    if (isCollectingGPS) {
      alert('⏳ Already collecting GPS')
      return
    }

    setIsCollectingGPS(true)
    setGpsStatus('📍 Collecting GPS (2 min)...')
    setGpsProgress(0)

    const readings = []
    let watchId = null
    const durationMs = 120000
    const startTime = Date.now()
    let lastUpdateTime = startTime

    const handlePosition = (position) => {
      readings.push({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy: position.coords.accuracy
      })

      const elapsed = Date.now() - startTime
      if (elapsed - lastUpdateTime > 1000) {
        lastUpdateTime = elapsed
        const progress = Math.min(100, Math.round((elapsed / durationMs) * 100))
        setGpsProgress(progress)
        setGpsStatus(`📍 ${progress}% | ${readings.length} readings`)
      }
    }

    const handleError = (error) => {
      navigator.geolocation.clearWatch(watchId)
      setIsCollectingGPS(false)
      setGpsStatus('')
      alert(`❌ GPS error: ${error.message}`)
    }

    watchId = navigator.geolocation.watchPosition(handlePosition, handleError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000
    })

    setTimeout(() => {
      navigator.geolocation.clearWatch(watchId)

      if (readings.length > 0) {
        const avgLat = readings.reduce((sum, r) => sum + r.lat, 0) / readings.length
        const avgLon = readings.reduce((sum, r) => sum + r.lon, 0) / readings.length
        const minAccuracy = Math.min(...readings.map(r => r.accuracy))

        setValue('latitude', avgLat.toFixed(6))
        setValue('longitude', avgLon.toFixed(6))
        setValue('accuracy', Math.round(minAccuracy))

        setGpsStatus(`✓ ${readings.length} readings, accuracy ±${Math.round(minAccuracy)}m`)
      } else {
        setGpsStatus('❌ No GPS readings')
      }

      setIsCollectingGPS(false)
      setTimeout(() => setGpsStatus(''), 2000)
    }, durationMs)
  }

  const updateVegetation = (category, value) => {
    const updated = { ...shortVegData }
    if (!updated[category]) updated[category] = {}
    updated[category].coverage = parseInt(value)
    setValue('vegetationShort', updated)
  }

  const handleSave = () => {
    if (!data.siteNumber) {
      alert('⚠️ Site number required')
      return
    }
    if (!data.latitude || !data.longitude) {
      alert('⚠️ GPS coordinates required')
      return
    }
    if (!data.landscape) {
      alert('⚠️ Landscape type required')
      return
    }
    onSave()
  }

  return (
    <div className="quick-entry">
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', justifyContent: 'space-between' }}>
        <button
          className="btn-back"
          onClick={onBack}
          style={{ padding: '8px 12px', fontSize: '12px', minHeight: '32px' }}
        >
          ← Full Mode
        </button>
        <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>
          ⚡ QUICK ENTRY
        </div>
        <div style={{ width: '80px' }}></div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {/* SITE NUMBER */}
        <div className="field-group">
          <label>Site #</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setValue('siteNumber', Math.max(1, (data.siteNumber || 1) - 1))}
              style={{ padding: '8px 10px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              −
            </button>
            <input
              type="number"
              value={data.siteNumber || 1}
              onChange={(e) => setValue('siteNumber', parseInt(e.target.value) || 1)}
              style={{ flex: 1, textAlign: 'center', fontWeight: '600' }}
            />
            <button
              onClick={() => setValue('siteNumber', (data.siteNumber || 1) + 1)}
              style={{ padding: '8px 10px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              +
            </button>
          </div>
        </div>

        {/* DATE & TIME */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div className="field-group">
            <label>Date</label>
            <input
              type="date"
              value={data.date || ''}
              onChange={(e) => setValue('date', e.target.value)}
            />
          </div>
          <div className="field-group">
            <label>Time</label>
            <input
              type="time"
              value={data.localTime || ''}
              onChange={(e) => setValue('localTime', e.target.value)}
            />
          </div>
        </div>

        {/* GPS */}
        <div className="field-group">
          <label>GPS Coordinates</label>
          <button
            onClick={getGPSCoordinates}
            disabled={isCollectingGPS}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: 'var(--primary-color)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: isCollectingGPS ? 'not-allowed' : 'pointer',
              opacity: isCollectingGPS ? 0.6 : 1,
              marginBottom: '8px'
            }}
          >
            📍 {isCollectingGPS ? 'Collecting...' : 'GET GPS (2 min)'}
          </button>

          {gpsStatus && (
            <div style={{ marginBottom: '8px' }}>
              <small style={{ color: '#666', display: 'block', marginBottom: '4px' }}>{gpsStatus}</small>
              {isCollectingGPS && (
                <div style={{ width: '100%', height: '4px', backgroundColor: '#e0e0e0', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${gpsProgress}%`, height: '100%', backgroundColor: '#4CAF50', transition: 'width 0.3s' }} />
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <small style={{ color: '#999', fontSize: '11px' }}>Latitude</small>
              <input
                type="number"
                step="0.000001"
                value={data.latitude || ''}
                onChange={(e) => setValue('latitude', e.target.value)}
                placeholder="Lat"
              />
            </div>
            <div>
              <small style={{ color: '#999', fontSize: '11px' }}>Longitude</small>
              <input
                type="number"
                step="0.000001"
                value={data.longitude || ''}
                onChange={(e) => setValue('longitude', e.target.value)}
                placeholder="Lon"
              />
            </div>
          </div>
        </div>

        {/* LANDSCAPE */}
        <div className="field-group">
          <label>Landscape</label>
          <div className="autocomplete-container">
            <input
              type="text"
              placeholder="RTS, Polygon, Shore..."
              value={data.landscape || ''}
              onChange={(e) => {
                const value = e.target.value
                setValue('landscape', value)
                if (value.length > 0) {
                  const filtered = allLandscapes.filter(l => l.toLowerCase().includes(value.toLowerCase()))
                  setLandscapeSuggestions(filtered)
                } else {
                  setLandscapeSuggestions([])
                }
              }}
            />
            {landscapeSuggestions.length > 0 && (
              <div className="autocomplete-suggestions">
                {landscapeSuggestions.map((suggestion) => (
                  <div
                    key={suggestion}
                    className="suggestion-item"
                    onClick={() => {
                      setValue('landscape', suggestion)
                      setLandscapeSuggestions([])
                    }}
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* STANDING WATER */}
        <div className="field-group">
          <label>Standing Water</label>
          <select
            value={data.standingWater ? 'yes' : 'no'}
            onChange={(e) => setValue('standingWater', e.target.value === 'yes')}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>

        {/* DISTURBANCE - Quick buttons */}
        <div className="field-group">
          <label>Disturbance</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginBottom: '8px' }}>
            {DISTURBANCE_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => setValue('disturbance', option)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: data.disturbance === option ? 'var(--primary-color)' : 'var(--bg-secondary)',
                  color: data.disturbance === option ? 'white' : 'var(--text-primary)',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* VEGETATION - Coverage only */}
        <div className="field-group">
          <label>Vegetation Coverage (0-2)</label>
          <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px' }}>
            0 = Absent | 1 = &lt;50% | 2 = &gt;50%
          </div>
          {vegetationCategories.map((cat) => (
            <div key={cat} style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600' }}>{cat}</label>
              <select
                value={shortVegData[cat]?.coverage || 0}
                onChange={(e) => updateVegetation(cat, e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '8px 10px'
                }}
              >
                <option value="0">0 - Absent</option>
                <option value="1">1 - Present</option>
                <option value="2">2 - Dominates</option>
              </select>
            </div>
          ))}
        </div>

        {/* SAVE BUTTON */}
        <button
          onClick={handleSave}
          style={{
            width: '100%',
            padding: '16px',
            background: 'linear-gradient(135deg, var(--success-color) 0%, #1b4332 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '700',
            fontSize: '16px',
            cursor: 'pointer',
            marginTop: '24px'
          }}
        >
          💾 SAVE ENTRY
        </button>
      </div>
    </div>
  )
}
