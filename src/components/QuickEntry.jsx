import { useState, useEffect } from 'react'

const LANDSCAPE_DEFAULTS = ['RTS', 'Polygon', 'Trench', 'Shore', 'Pond', 'Hummock', 'Palsa', 'Thermokarst', 'Degraded', 'Wet Sedge', 'Dry Moss', 'Mixed']
const DISTURBANCE_OPTIONS = ['None', 'Thermokarst', 'Solifluction', 'Erosion', 'Trampling', 'Other']
const HYDROTILE_OPTIONS = ['Up-up', 'Up-low', 'Low-up', 'Low-low']

export default function QuickEntry({ watch, setValue, onSave, onBack }) {
  const [landscapeSuggestions, setLandscapeSuggestions] = useState([])
  const [allLandscapes] = useState(LANDSCAPE_DEFAULTS)
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

  const updateVegetation = (category, value) => {
    // Immutable update: create a fresh nested object so react-hook-form detects the
    // change and re-renders immediately (fixes the value appearing one step late).
    const updated = {
      ...shortVegData,
      [category]: { ...(shortVegData[category] || {}), coverage: parseInt(value) }
    }
    setValue('vegetationShort', updated, { shouldDirty: true })
  }

  const handlePhoto = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => setValue('entryPhotos', [...(data.entryPhotos || []), { id: Date.now(), originalData: reader.result, previewData: reader.result, name: file.name, type: file.type }])
      reader.readAsDataURL(file)
    }
    e.target.value = ''
  }

  const handleSave = () => {
    if (!data.landscape) {
      alert('⚠️ Landscape type required')
      return
    }
    onSave()
  }

  return (
    <div className="quick-entry" style={{ paddingTop: '70px' }}>
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
        {/* AREA + COLLAR */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="field-group">
            <label>Area</label>
            <input
              type="text"
              value={data.area || ''}
              onChange={(e) => setValue('area', e.target.value)}
              placeholder="Area name / ID"
            />
          </div>
          <div className="field-group">
            <label>Collar</label>
            <input
              type="text"
              value={data.collar || ''}
              onChange={(e) => setValue('collar', e.target.value)}
              placeholder="Collar ID"
            />
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

        {/* STANDING WATER + HYDROTILES */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
          <div className="field-group">
            <label>Hydrotiles</label>
            <select value={data.hydrotiles || ''} onChange={(e) => setValue('hydrotiles', e.target.value)}>
              <option value="">Select...</option>
              {HYDROTILE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        {/* DISTURBANCE - pick an option from the list or type a custom value */}
        <div className="field-group">
          <label>Disturbance</label>
          <input
            type="text"
            list="quickDisturbanceOptions"
            value={data.disturbance || ''}
            onChange={(e) => setValue('disturbance', e.target.value)}
            placeholder="Choose or type…"
          />
          <datalist id="quickDisturbanceOptions">
            {DISTURBANCE_OPTIONS.map((o) => <option key={o} value={o} />)}
          </datalist>
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

        {/* SITE PHOTO (required) */}
        <div className="field-group">
          <label>📷 Site Photo</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-block', padding: '10px 14px', backgroundColor: 'var(--primary-color)', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>
              📸 Camera
              <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
            </label>
            <label style={{ display: 'inline-block', padding: '10px 14px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>
              📁 Gallery
              <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
            </label>
            {(data.entryPhotos || []).map((photo) => (
              <div key={photo.id} style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', width: '52px', height: '52px' }}>
                <img src={photo.previewData || photo.originalData} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button onClick={() => setValue('entryPhotos', (data.entryPhotos || []).filter((p) => p.id !== photo.id))} style={{ position: 'absolute', top: '1px', right: '1px', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer', fontSize: '11px', padding: 0, lineHeight: '18px' }}>✕</button>
              </div>
            ))}
          </div>
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
