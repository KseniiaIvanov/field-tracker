import { useState, useRef } from 'react'

export default function VegetationShort({ control, watch, setValue }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [customInput, setCustomInput] = useState('')
  const data = watch()

  const shortVegData = data.vegetationShort || {}

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

              <div className="field-group">
                <label>Coverage</label>
                <select
                  value={shortVegData[category]?.coverage || 0}
                  onChange={(e) => updateVegetation(category, 'coverage', parseInt(e.target.value))}
                >
                  {coverageOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label>Height</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={shortVegData[category]?.height || ''}
                    onChange={(e) => updateVegetation(category, 'height', parseFloat(e.target.value) || '')}
                    placeholder="Optional"
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontWeight: 600, minWidth: '30px' }}>cm</span>
                </div>
              </div>

              <div className="field-group">
                <label>Notes</label>
                <input
                  type="text"
                  value={shortVegData[category]?.notes || ''}
                  onChange={(e) => updateVegetation(category, 'notes', e.target.value)}
                  placeholder="Optional notes"
                />
              </div>

              <button className="btn-photo" onClick={() => alert('Camera feature coming soon')}>
                📷 Add Photo
              </button>
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
              />
              <button
                className="btn-add"
                onClick={() => {
                  if (customInput.trim()) {
                    const customName = customInput.trim()
                    const updated = { ...shortVegData }
                    updated[customName] = { coverage: 0, height: '', notes: '' }
                    setValue('vegetationShort', updated)
                    setCustomInput('')
                  }
                }}
              >
                + Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
