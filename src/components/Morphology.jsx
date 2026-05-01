import { useState } from 'react'

export default function Morphology({ control, watch, setValue }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const data = watch()

  const morphologyData = data.morphology || ''

  const morphologyOptions = [
    { value: 'slope', label: 'Slope' },
    { value: 'depression', label: 'Depression' },
    { value: 'elevated', label: 'Elevated' }
  ]

  return (
    <div className={`section ${!isExpanded ? 'collapsed' : ''}`}>
      <button
        className="section-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2>Morphology</h2>
        <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
      </button>

      {isExpanded && (
        <div className="section-content">
          <div className="field-group">
            <label>Topography</label>
            <div className="morphology-buttons">
              {morphologyOptions.map((option) => (
                <button
                  key={option.value}
                  className={`morphology-btn ${morphologyData === option.value ? 'active' : ''}`}
                  onClick={() => setValue('morphology', option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>


          <div className="field-group">
            <label>Water Features</label>
            <textarea
              value={data.waterFeatures || ''}
              onChange={(e) => setValue('waterFeatures', e.target.value)}
              placeholder="Streams, lakes, drainage patterns..."
              rows="3"
            />
          </div>

          <div className="field-group">
            <label>General Description</label>
            <textarea
              value={data.morphologyNotes || ''}
              onChange={(e) => setValue('morphologyNotes', e.target.value)}
              placeholder="Additional observations about landscape morphology"
              rows="3"
            />
          </div>

          <button className="btn-photo" onClick={() => alert('Camera feature coming soon')}>
            📷 Add Morphology Photo
          </button>
        </div>
      )}
    </div>
  )
}
