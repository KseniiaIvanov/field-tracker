import { useState } from 'react'

export default function VegetationLong({ control, watch, setValue }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [customSpecies, setCustomSpecies] = useState('')
  const data = watch()

  const longVegData = data.vegetationLong || []
  const vegPhotos = data.vegetationLongPhotos || []

  const addSpecies = (name, percentage = 0) => {
    const newSpecies = {
      id: Date.now(),
      name,
      percentage: percentage || 0
    }
    setValue('vegetationLong', [...longVegData, newSpecies])
  }

  const removeSpecies = (id) => {
    setValue('vegetationLong', longVegData.filter(s => s.id !== id))
  }

  const updateSpecies = (id, field, value) => {
    setValue('vegetationLong', longVegData.map(s =>
      s.id === id ? { ...s, [field]: value } : s
    ))
  }

  const handleAddCustom = () => {
    if (customSpecies.trim()) {
      addSpecies(customSpecies.trim())
      setCustomSpecies('')
    }
  }

  const addPhoto = (file) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const newPhoto = {
        id: Date.now(),
        data: reader.result,
        name: file.name
      }
      setValue('vegetationLongPhotos', [...vegPhotos, newPhoto])
    }
    reader.readAsDataURL(file)
  }

  const removePhoto = (id) => {
    setValue('vegetationLongPhotos', vegPhotos.filter(p => p.id !== id))
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
        <h2>Vegetate. Long description</h2>
        <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
      </button>

      {isExpanded && (
        <div className="section-content">
          {longVegData.map((species) => (
            <div key={species.id} className="species-item">
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ minWidth: '100px', fontWeight: 600 }}>Species Name</label>
                <input
                  type="text"
                  value={species.name}
                  onChange={(e) => updateSpecies(species.id, 'name', e.target.value)}
                  style={{ minWidth: '200px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ minWidth: '100px', fontWeight: 600 }}>Percentage (%)</label>
                <div className="percentage-input" style={{ display: 'flex', gap: '8px', alignItems: 'center', minWidth: '200px' }}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={species.percentage}
                    onChange={(e) => updateSpecies(species.id, 'percentage', parseInt(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span className="value-display" style={{ minWidth: '40px' }}>{species.percentage}%</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ minWidth: '100px', fontWeight: 600 }}>Notes</label>
                <input
                  type="text"
                  value={species.notes || ''}
                  onChange={(e) => updateSpecies(species.id, 'notes', e.target.value)}
                  placeholder="Optional notes"
                  style={{ minWidth: '200px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px' }}
                />
              </div>

              <div className="species-actions">
                <button className="btn-delete" onClick={() => removeSpecies(species.id)}>
                  ✕ Remove
                </button>
              </div>
            </div>
          ))}

          <div className="add-species-form">
            <h3>Add New Species</h3>
            <div className="form-row">
              <input
                type="text"
                placeholder="Species name"
                value={customSpecies}
                onChange={(e) => setCustomSpecies(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddCustom()
                  }
                }}
                style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px' }}
              />
              <button className="btn-add" onClick={handleAddCustom}>
                + Add Species
              </button>
            </div>
          </div>

          {longVegData.length > 0 && (
            <div className="total-coverage">
              <strong>Total Coverage: {Math.min(100, longVegData.reduce((sum, s) => sum + (s.percentage || 0), 0))}%</strong>
            </div>
          )}

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
