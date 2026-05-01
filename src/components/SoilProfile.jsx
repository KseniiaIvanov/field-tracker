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

  const soilStructures = [
    'Granular',
    'Crumb',
    'Platy',
    'Prismatic',
    'Columnar',
    'Massive',
    'Single grain'
  ]

  const soilColors = [
    'Black',
    'Dark brown',
    'Brown',
    'Light brown',
    'Yellowish brown',
    'Reddish brown',
    'Gray',
    'Dark gray',
    'Light gray'
  ]

  const addLayer = () => {
    const newLayer = {
      id: Date.now(),
      depthFrom: '',
      depthTo: '',
      color: '',
      structure: '',
      moisture: 'moist',
      texture: '',
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
                    flex: 1,
                    borderColor: errors.activeLayer ? '#d32f2f' : undefined
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
                    flex: 1,
                    borderColor: errors.organicLayer ? '#d32f2f' : undefined
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
                    flex: 1,
                    borderColor: errors.soilTemp ? '#d32f2f' : undefined
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
                        flex: 1,
                        borderColor: errors[`depth_${layer.id}`] ? '#d32f2f' : undefined
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
                        flex: 1,
                        borderColor: errors[`depth_${layer.id}`] ? '#d32f2f' : undefined
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
                  <label>Color</label>
                  <select
                    value={layer.color}
                    onChange={(e) => updateLayer(layer.id, 'color', e.target.value)}
                  >
                    <option value="">Select color...</option>
                    {soilColors.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="field-group">
                  <label>Structure</label>
                  <select
                    value={layer.structure}
                    onChange={(e) => updateLayer(layer.id, 'structure', e.target.value)}
                  >
                    <option value="">Select structure...</option>
                    {soilStructures.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="field-group">
                  <label>Moisture</label>
                  <select
                    value={layer.moisture}
                    onChange={(e) => updateLayer(layer.id, 'moisture', e.target.value)}
                  >
                    <option value="dry">Dry</option>
                    <option value="moist">Moist</option>
                    <option value="wet">Wet</option>
                  </select>
                </div>

                <div className="field-group">
                  <label>Texture</label>
                  <input
                    type="text"
                    placeholder="e.g., Sandy clay loam"
                    value={layer.texture}
                    onChange={(e) => updateLayer(layer.id, 'texture', e.target.value)}
                  />
                </div>

                <div className="field-group">
                  <label>Notes</label>
                  <textarea
                    value={layer.notes}
                    onChange={(e) => updateLayer(layer.id, 'notes', e.target.value)}
                    placeholder="Detailed observations"
                    rows="2"
                  />
                </div>

                <button className="btn-photo" onClick={() => alert('Camera feature coming soon')}>
                  📷 Add Photo
                </button>
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
