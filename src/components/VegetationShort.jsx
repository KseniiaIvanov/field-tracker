import { useState, useRef } from 'react'

export default function VegetationShort({ control, watch, setValue }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [customInput, setCustomInput] = useState('')
  const data = watch()

  const shortVegData = data.vegetationShort || {}
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

  const coverageOptions = [
    { value: 0, label: '0 - Absent' },
    { value: 1, label: '1 - Present (<50%)' },
    { value: 2, label: '2 - Dominates (>50%)' }
  ]

  const updateVegetation = (category, field, value) => {
    const updated = { ...shortVegData }
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
          {/* Display all categories (standard + custom) */}
          {Object.keys(shortVegData).map((category) => (
            <div key={category} className="vegetation-item">
              <div className="vegetation-category-header">
                <div className="vegetation-category-name">{category}</div>
                {!categories.includes(category) && (
                  <button
                    className="btn-delete-small"
                    onClick={() => {
                      const updated = { ...shortVegData }
                      delete updated[category]
                      setValue('vegetationShort', updated)
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ width: '70px', fontWeight: 600, fontSize: '12px', flexShrink: 0 }}>Coverage</label>
                <select
                  value={shortVegData[category]?.coverage || 0}
                  onChange={(e) => updateVegetation(category, 'coverage', parseInt(e.target.value))}
                  style={{ flex: 1, maxWidth: '200px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px' }}
                >
                  {coverageOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ width: '70px', fontWeight: 600, fontSize: '12px', flexShrink: 0 }}>Height</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={shortVegData[category]?.height || ''}
                  onChange={(e) => updateVegetation(category, 'height', parseFloat(e.target.value) || '')}
                  placeholder="Optional"
                  style={{ flex: 1, maxWidth: '100px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px' }}
                />
                <span style={{ fontWeight: 600, fontSize: '12px', flexShrink: 0 }}>cm</span>
              </div>

            </div>
          ))}

          <div className="custom-items-section">
            <h3>Add Custom Category</h3>
            <div className="form-row">
              <input
                type="text"
                placeholder="Enter custom vegetation type"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px' }}
              />
              <button
                className="btn-add"
                onClick={() => {
                  if (customInput.trim()) {
                    const customName = customInput.trim()
                    const updated = { ...shortVegData }
                    updated[customName] = { coverage: 0, height: '' }
                    setValue('vegetationShort', updated)
                    setCustomInput('')
                  }
                }}
              >
                + Add
              </button>
            </div>
          </div>

          <div className="field-group" style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
            <label>General Notes (all groups)</label>
            <textarea
              value={data.vegetationShortNotes || ''}
              onChange={(e) => setValue('vegetationShortNotes', e.target.value)}
              placeholder="Optional notes about vegetation coverage, distribution, or observations..."
              rows="3"
              style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', fontFamily: 'inherit', width: '100%' }}
            />
          </div>

          <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
            <h3 style={{ marginBottom: '12px' }}>Vegetation Photos</h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'inline-block', padding: '10px 16px', backgroundColor: 'var(--primary-color)', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
                📷 Add Photos
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {vegPhotos.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '12px' }}>
                {vegPhotos.map((photo) => (
                  <div key={photo.id} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--bg-secondary)' }}>
                    <img src={photo.data} alt={photo.name} style={{ width: '100%', height: '100px', objectFit: 'cover' }} />
                    <button
                      onClick={() => removePhoto(photo.id)}
                      style={{ position: 'absolute', top: '4px', right: '4px', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
