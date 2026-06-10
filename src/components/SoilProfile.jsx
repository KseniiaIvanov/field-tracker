import { useState } from 'react'
import {
  validateTemperature,
  validateSoilDepth,
  validateOrganicLayer
} from '../utils/validation'

export default function SoilProfile({ watch, setValue }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [errors, setErrors] = useState({})
  const data = watch()

  const soilData = data.soilProfile || []

  const setFieldError = (field, error) => {
    setErrors(prev => ({
      ...prev,
      [field]: error
    }))
  }

  const soilTypes = [
    'Sand',
    'Clay',
    'Loam',
    'Mixed',
    'Organic'
  ]

  const addLayer = () => {
    const newLayer = {
      id: Date.now(),
      depthFrom: '',
      depthTo: '',
      soilType: '',
      notes: ''
    }
    setValue('soilProfile', [...soilData, newLayer])
  }

  const removeLayer = (id) => {
    setValue('soilProfile', soilData.filter(l => l.id !== id))
  }

  const updateLayer = (id, field, value) => {
    setValue('soilProfile', soilData.map(l =>
      l.id === id ? { ...l, [field]: value } : l
    ))
  }

  return (
    <div className={`section ${!isExpanded ? 'collapsed' : ''}`}>
      <button
        className="section-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2>Soil Profile</h2>
        <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
      </button>

      {isExpanded && (
        <div className="section-content">
          <div className="soil-measurements">
            <div className="field-group">
              <label>AL Depth cm (3 readings)</label>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                {[1, 2, 3].map(i => (
                  <input
                    key={i}
                    type="number" min="0" step="1"
                    value={data[`alDepth${i}`] ?? ''}
                    placeholder={`#${i}`}
                    onChange={(e) => {
                      const v = e.target.value === '' ? '' : parseFloat(e.target.value)
                      setValue(`alDepth${i}`, v)
                      const vals = [
                        i === 1 ? v : data.alDepth1,
                        i === 2 ? v : data.alDepth2,
                        i === 3 ? v : data.alDepth3
                      ].filter(x => x !== '' && x !== null && x !== undefined && !isNaN(x))
                      setValue('activeLayerDepth', vals.length ? Math.round(vals.reduce((a, b) => a + Number(b), 0) / vals.length) : '')
                    }}
                    style={{ width: '64px', textAlign: 'center', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 8px' }}
                  />
                ))}
                {data.activeLayerDepth !== '' && data.activeLayerDepth !== undefined && (
                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary-color)', whiteSpace: 'nowrap' }}>
                    ∅ {data.activeLayerDepth} cm
                  </span>
                )}
              </div>
            </div>

            {/* Row: Soil Temp + Soil Moisture % */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="field-group">
                <label>Soil Temp °C</label>
                <input
                  type="number" step="0.1"
                  value={data.soilTemperature || ''}
                  onChange={(e) => {
                    const value = e.target.value
                    const validation = validateTemperature(value)
                    setFieldError('soilTemp', validation.valid ? null : validation.message)
                    setValue('soilTemperature', parseFloat(value) || '')
                  }}
                  placeholder="°C"
                  style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: errors.soilTemp ? '1px solid #d32f2f' : '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px' }}
                />
                {errors.soilTemp && <small style={{ color: '#d32f2f', marginTop: '4px', display: 'block' }}>⚠️ {errors.soilTemp}</small>}
              </div>
              <div className="field-group">
                <label>Soil Moisture %</label>
                <input
                  type="number" step="0.1" min="0" max="100"
                  value={data.soilMoisture || ''}
                  onChange={(e) => setValue('soilMoisture', e.target.value ? parseFloat(e.target.value) : '')}
                  placeholder="%"
                  style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px' }}
                />
              </div>
            </div>

            {/* Row: Soil Moisture Type + Standing Water */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="field-group">
                <label>Moisture Type</label>
                <select value={data.soilMoistureType || 'moist'} onChange={(e) => setValue('soilMoistureType', e.target.value)}>
                  <option value="dry">Dry</option>
                  <option value="moist">Moist</option>
                  <option value="wet">Wet</option>
                  <option value="saturated">Saturated</option>
                </select>
              </div>
              <div className="field-group">
                <label>Standing Water</label>
                <select value={data.standingWater ? 'yes' : 'no'} onChange={(e) => setValue('standingWater', e.target.value === 'yes')}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
            </div>

            {data.standingWater && (
              <div className="field-group">
                <label>Standing Water Depth cm</label>
                <input
                  type="number" min="0" step="0.5"
                  value={data.standingWaterDepth || ''}
                  onChange={(e) => setValue('standingWaterDepth', parseFloat(e.target.value) || '')}
                  placeholder="Depth"
                  style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px' }}
                />
              </div>
            )}

            <div className="field-group">
              <label>Organic Layer Depth</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={data.organicLayerDepth || ''}
                  onChange={(e) => {
                    const value = e.target.value
                    const validation = validateOrganicLayer(value)
                    setFieldError('organicLayer', validation.valid ? null : validation.message)
                    setValue('organicLayerDepth', parseFloat(value) || '')
                  }}
                  placeholder="Organic layer thickness"
                  style={{
                    minWidth: '80px',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    border: errors.organicLayer ? '1px solid #d32f2f' : '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '10px 12px'
                  }}
                />
                <span style={{ fontWeight: 600, minWidth: '30px' }}>cm</span>
              </div>
              {errors.organicLayer && (
                <small style={{ color: '#d32f2f', marginTop: '4px', display: 'block' }}>
                  ⚠️ {errors.organicLayer}
                </small>
              )}
            </div>

          </div>

          <h3>Soil Layers</h3>
          <div className="soil-layers">
            {soilData.map((layer) => (
              <div key={layer.id} className="soil-layer">
                <div className="layer-header">
                  <span>Layer {soilData.indexOf(layer) + 1}</span>
                  <button className="btn-delete" onClick={() => removeLayer(layer.id)}>✕</button>
                </div>

                <div className="field-group">
                  <label>Depth From</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={layer.depthFrom}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || ''
                        updateLayer(layer.id, 'depthFrom', value)
                        // Validate with depthTo
                        if (value && layer.depthTo) {
                          const validation = validateSoilDepth(value, layer.depthTo)
                          setFieldError(`depth_${layer.id}`, validation.valid ? null : validation.message)
                        }
                      }}
                      style={{
                        minWidth: '80px',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        border: errors[`depth_${layer.id}`] ? '1px solid #d32f2f' : '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '10px 12px'
                      }}
                    />
                    <span style={{ fontWeight: 600, minWidth: '30px' }}>cm</span>
                  </div>
                </div>

                <div className="field-group">
                  <label>Depth To</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={layer.depthTo}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || ''
                        updateLayer(layer.id, 'depthTo', value)
                        // Validate with depthFrom
                        if (value && layer.depthFrom) {
                          const validation = validateSoilDepth(layer.depthFrom, value)
                          setFieldError(`depth_${layer.id}`, validation.valid ? null : validation.message)
                        }
                      }}
                      style={{
                        minWidth: '80px',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        border: errors[`depth_${layer.id}`] ? '1px solid #d32f2f' : '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '10px 12px'
                      }}
                    />
                    <span style={{ fontWeight: 600, minWidth: '30px' }}>cm</span>
                  </div>
                  {errors[`depth_${layer.id}`] && (
                    <small style={{ color: '#d32f2f', marginTop: '4px', display: 'block' }}>
                      ⚠️ {errors[`depth_${layer.id}`]}
                    </small>
                  )}
                </div>

                <div className="field-group">
                  <label>Soil Type</label>
                  <select
                    value={layer.soilType}
                    onChange={(e) => updateLayer(layer.id, 'soilType', e.target.value)}
                  >
                    <option value="">Select soil type...</option>
                    {soilTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className="field-group">
                  <label>Notes</label>
                  <textarea
                    value={layer.notes}
                    onChange={(e) => updateLayer(layer.id, 'notes', e.target.value)}
                    placeholder="Detailed observations"
                    rows="2"
                    style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', fontFamily: 'inherit', width: '100%' }}
                  />
                </div>
              </div>
            ))}
          </div>

          <button className="btn-add-layer" onClick={addLayer}>
            + Add Soil Layer
          </button>
        </div>
      )}
    </div>
  )
}
