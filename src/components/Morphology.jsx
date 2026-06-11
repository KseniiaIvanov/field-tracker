import { useState } from 'react'

const DISTURBANCE_OPTIONS = ['None', 'Thermokarst', 'Solifluction', 'Erosion', 'Trampling', 'Other']

export default function Morphology({ watch, setValue }) {
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
            <label>Disturbances</label>
            <input
              type="text"
              list="morphDisturbanceOptions"
              value={data.disturbance || ''}
              onChange={(e) => setValue('disturbance', e.target.value)}
              maxLength="60"
              placeholder="Choose or type…"
              style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
            />
            <datalist id="morphDisturbanceOptions">
              {DISTURBANCE_OPTIONS.map((o) => <option key={o} value={o} />)}
            </datalist>
          </div>

          <div className="field-group">
            <label>Water Features</label>
            <textarea
              value={data.waterFeatures || ''}
              onChange={(e) => setValue('waterFeatures', e.target.value)}
              placeholder="Streams, lakes, drainage patterns..."
              rows="3"
              style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div className="field-group">
            <label>General Description</label>
            <textarea
              value={data.morphologyNotes || ''}
              onChange={(e) => setValue('morphologyNotes', e.target.value)}
              placeholder="Additional observations about landscape morphology"
              rows="3"
              style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
