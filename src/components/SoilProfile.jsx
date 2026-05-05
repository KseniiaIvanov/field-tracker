import { useState } from 'react'
import {
  validateTemperature,
  validateSoilDepth,
  validateActiveLayer,
  validateOrganicLayer
} from '../utils/validation'

export default function SoilProfile({ control, watch, setValue }) {
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
              <label>Active Layer Depth</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={data.activeLayerDepth || ''}
                  onChange={(e) => {
                    const value = e.target.value
                    const validation = validateActiveLayer(value)
                    setFieldError('activeLayer', validation.valid ? null : validation.message)
                    setValue('activeLayerDepth', parseFloat(value) || '')
                  }}
                  placeholder="Thaw depth"
                  style={{
                    minWidth: '80px',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    border: errors.activeLayer ? '1px solid #d32f2f' : '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '10px 12px'
                  }}
                />
                <span style={{ fontWeight: 600, minWidth: '30px' }}>cm</span>
              </div>
              {errors.activeLayer && (
                <small style={{ color: '#d32f2f', marginTop: '4px', display: 'block' }}>
                  ⚠️ {errors.activeLayer}
                </small>
              )}
            </div>

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

            <div className="field-group">
              <label>Soil Temperature</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="number"
                  step="0.1"
                  value={data.soilTemperature || ''}
                  onChange={(e) => {
                    const value = e.target.value
                    const validation = validateTemperature(value)
                    setFieldError('soilTemp', validation.valid ? null : validation.message)
                    setValue('soilTemperature', parseFloat(value) || '')
                  }}
                  placeholder="At measurement depth"
                  style={{
                    minWidth: '80px',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    border: errors.soilTemp ? '1px solid #d32f2f' : '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '10px 12px'
                  }}
                />
                <span style={{ fontWeight: 600, minWidth: '40px' }}>°C</span>
              </div>
              {errors.soilTemp && (
                <small style={{ color: '#d32f2f', marginTop: '4px', display: 'block' }}>
                  ⚠️ {errors.soilTemp}
                </small>
              )}
            </div>

            <div className="field-group">
              <label>Soil Moisture</label>
              <select
                value={data.soilMoisture || 'moist'}
                onChange={(e) => setValue('soilMoisture', e.target.value)}
              >
                <option value="dry">Dry</option>
                <option value="moist">Moist</option>
                <option value="wet">Wet</option>
                <option value="saturated">Saturated</option>
              </select>
            </div>

            <div className="field-group">
              <label>Standing Water Present</label>
              <select
                value={data.standingWater ? 'yes' : 'no'}
                onChange={(e) => setValue('standingWater', e.target.value === 'yes')}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            {data.standingWater && (
              <div className="field-group">
                <label>Standing Water Depth</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={data.standingWaterDepth || ''}
                    onChange={(e) => setValue('standingWaterDepth', parseFloat(e.target.value) || '')}
                    placeholder="Water depth"
                    style={{
                      minWidth: '80px',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '10px 12px'
                    }}
                  />
                  <span style={{ fontWeight: 600, minWidth: '30px' }}>cm</span>
                </div>
              </div>
            )}
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
