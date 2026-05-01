import { useState } from 'react'

export default function VegetationLong({ control, watch, setValue }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [customSpecies, setCustomSpecies] = useState('')
  const data = watch()

  const longVegData = data.vegetationLong || []

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
              <div className="field-group">
                <label>Species Name</label>
                <input
                  type="text"
                  value={species.name}
                  onChange={(e) => updateSpecies(species.id, 'name', e.target.value)}
                />
              </div>

              <div className="field-group">
                <label>Percentage (%)</label>
                <div className="percentage-input">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={species.percentage}
                    onChange={(e) => updateSpecies(species.id, 'percentage', parseInt(e.target.value))}
                  />
                  <span className="value-display">{species.percentage}%</span>
                </div>
              </div>

              <div className="field-group">
                <label>Notes</label>
                <input
                  type="text"
                  value={species.notes || ''}
                  onChange={(e) => updateSpecies(species.id, 'notes', e.target.value)}
                  placeholder="Optional notes"
                />
              </div>

              <div className="species-actions">
                <button className="btn-photo" onClick={() => alert('Camera feature coming soon')}>
                  📷 Photo
                </button>
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
        </div>
      )}
    </div>
  )
}
