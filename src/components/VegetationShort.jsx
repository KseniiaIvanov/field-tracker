import { useState } from 'react'

export default function VegetationShort({ watch, setValue }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [customInput, setCustomInput] = useState('')
  const [optimisticData, setOptimisticData] = useState({})
  const data = watch()

  const shortVegData = { ...data.vegetationShort, ...optimisticData }
  const vegPhotos = data.vegetationShortPhotos || []

  const categories = [
    'Shrubs',
    'Dwarf Shrubs',
    'Grass',
    'Sedges',
    'Green Mosses',
    'Sphagnum Mosses',
    'Brown Mosses',
    'Lichens',
    'Bare Peat',
    'Litter Standing Dead'
  ]

  const updateVegetation = (category, field, value) => {
    // Optimistic update - show immediately
    setOptimisticData(prev => ({
      ...prev,
      [category]: { ...(prev[category] || data.vegetationShort?.[category] || {}), [field]: value }
    }))

    // Persist to form state
    const updated = { ...data.vegetationShort, ...optimisticData }
    if (!updated[category]) updated[category] = {}
    updated[category][field] = value
    setValue('vegetationShort', updated)
  }

  const addPhoto = (file) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const newPhoto = {
        id: Date.now(),
        data: reader.result,
        name: file.name
      }
      setValue('vegetationShortPhotos', [...vegPhotos, newPhoto])
    }
    reader.readAsDataURL(file)
  }

  const removePhoto = (id) => {
    setValue('vegetationShortPhotos', vegPhotos.filter(p => p.id !== id))
  }

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files || [])
    files.forEach(file => addPhoto(file))
    e.target.value = ''
  }

  return (
    <div className={`section ${!isExpanded ? 'collapsed' : ''}`}>
      <button
        className="section-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2>Vegetate. Short description</h2>
        <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
      </button>

      {isExpanded && (
        <div className="section-content">
          <div style={{ fontSize: '11px', color: '#999', marginBottom: '8px', display: 'flex', gap: '8px' }}>
            <span style={{ flex: 1 }}></span>
            <span style={{ width: '90px', textAlign: 'center' }}>0 · 1 · 2</span>
            <span style={{ width: '55px', textAlign: 'center' }}>cm</span>
            <span style={{ width: '20px' }}></span>
          </div>

          {Object.keys(shortVegData).map((category) => (
            <div key={category} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '5px', padding: '5px 8px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px' }}>
              <div style={{ flex: 1, fontSize: '13px', fontWeight: '500' }}>{category}</div>
              <div style={{ display: 'flex', gap: '3px' }}>
                {[0, 1, 2].map(v => {
                  const active = (shortVegData[category]?.coverage ?? 0) === v
                  return (
                    <button
                      key={v}
                      onClick={() => updateVegetation(category, 'coverage', v)}
                      style={{
                        width: '28px', height: '28px', flexShrink: 0,
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px', fontSize: '12px', fontWeight: '700',
                        cursor: 'pointer',
                        backgroundColor: active ? 'var(--primary-color)' : 'var(--bg-primary)',
                        color: active ? 'white' : 'var(--text-secondary)'
                      }}
                    >{v}</button>
                  )
                })}
              </div>
              <input
                type="number"
                min="0"
                step="1"
                value={shortVegData[category]?.height || ''}
                onChange={(e) => updateVegetation(category, 'height', parseFloat(e.target.value) || '')}
                placeholder="—"
                style={{ width: '55px', padding: '4px 6px', fontSize: '12px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              />
              {!categories.includes(category) && (
                <button
                  onClick={() => { const updated = { ...shortVegData }; delete updated[category]; setValue('vegetationShort', updated) }}
                  style={{ padding: '2px 5px', color: '#aaa', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', flexShrink: 0 }}
                >✕</button>
              )}
            </div>
          ))}

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Add custom type..."
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && customInput.trim()) {
                  const updated = { ...shortVegData }
                  updated[customInput.trim()] = { coverage: 0, height: '' }
                  setValue('vegetationShort', updated)
                  setCustomInput('')
                }
              }}
              style={{ flex: 1, padding: '6px 10px', fontSize: '13px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            />
            <button
              onClick={() => {
                if (customInput.trim()) {
                  const updated = { ...shortVegData }
                  updated[customInput.trim()] = { coverage: 0, height: '' }
                  setValue('vegetationShort', updated)
                  setCustomInput('')
                }
              }}
              style={{ padding: '6px 14px', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap' }}
            >+ Add</button>
          </div>

          <textarea
            value={data.vegetationShortNotes || ''}
            onChange={(e) => setValue('vegetationShortNotes', e.target.value)}
            placeholder="Notes..."
            rows="2"
            style={{ marginTop: '12px', width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />

          <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-block', padding: '6px 14px', backgroundColor: 'var(--primary-color)', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', flexShrink: 0 }}>
              📸 Camera
              <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} style={{ display: 'none' }} />
            </label>
            <label style={{ display: 'inline-block', padding: '6px 14px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', flexShrink: 0 }}>
              📷 Gallery
              <input type="file" multiple accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
            </label>
            {vegPhotos.map((photo) => (
              <div key={photo.id} style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', width: '56px', height: '56px', flexShrink: 0 }}>
                <img src={photo.data} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button onClick={() => removePhoto(photo.id)} style={{ position: 'absolute', top: '1px', right: '1px', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer', fontSize: '11px', padding: 0, lineHeight: '18px', textAlign: 'center' }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
