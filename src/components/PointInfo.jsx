import { useState, useEffect } from 'react'
import { validateCoordinates, validateSiteNumber } from '../utils/validation'
import piexif from 'piexifjs'

const LANDSCAPE_DEFAULTS = ['RTS', 'Polygon', 'Trench', 'Shore', 'Pond', 'Hummock', 'Palsa', 'Thermokarst', 'Degraded', 'Wet Sedge', 'Dry Moss', 'Mixed']

export default function PointInfo({ control, watch, setValue }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [landscapeSuggestions, setLandscapeSuggestions] = useState([])
  const [allLandscapes, setAllLandscapes] = useState(LANDSCAPE_DEFAULTS)
  const [errors, setErrors] = useState({})
  const [uploadedPhoto, setUploadedPhoto] = useState(null)
  const [photoMessage, setPhotoMessage] = useState('')
  const data = watch()

  const setFieldError = (field, error) => {
    setErrors(prev => ({
      ...prev,
      [field]: error
    }))
  }

  // Auto-fill current time and GPS on mount
  useEffect(() => {
    const now = new Date()

    // Auto-fill time if not set
    if (!data.localTime) {
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      setValue('localTime', `${hours}:${minutes}`)
    }

    // Auto-fill GPS coordinates if available
    if ('geolocation' in navigator && !data.latitude) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setValue('latitude', position.coords.latitude.toFixed(6))
          setValue('longitude', position.coords.longitude.toFixed(6))
          setValue('accuracy', Math.round(position.coords.accuracy))
        },
        (error) => {
          console.log('GPS unavailable:', error.message)
        }
      )
    }
  }, [])

  const incrementSite = () => {
    setValue('siteNumber', (data.siteNumber || 1) + 1)
  }

  const decrementSite = () => {
    setValue('siteNumber', Math.max(1, (data.siteNumber || 1) - 1))
  }

  // Extract GPS coordinates from photo EXIF
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const binaryData = event.target.result
          // Convert ArrayBuffer to binary string for piexif
          let binary = ''
          const bytes = new Uint8Array(binaryData)
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i])
          }

          const exifData = piexif.load(binary)

          // Check if GPS data exists
          if (exifData.GPS) {
            const gps = exifData.GPS

            // Extract latitude
            if (gps[piexif.GPSIFD.GPSLatitude]) {
              const latRef = String.fromCharCode(...gps[piexif.GPSIFD.GPSLatitudeRef])
              const latArray = gps[piexif.GPSIFD.GPSLatitude]
              const lat = latArray[0][0] / latArray[0][1] +
                         latArray[1][0] / latArray[1][1] / 60 +
                         latArray[2][0] / latArray[2][1] / 3600
              const latitude = latRef === 'S' ? -lat : lat

              setValue('latitude', latitude.toFixed(6))
            }

            // Extract longitude
            if (gps[piexif.GPSIFD.GPSLongitude]) {
              const lonRef = String.fromCharCode(...gps[piexif.GPSIFD.GPSLongitudeRef])
              const lonArray = gps[piexif.GPSIFD.GPSLongitude]
              const lon = lonArray[0][0] / lonArray[0][1] +
                         lonArray[1][0] / lonArray[1][1] / 60 +
                         lonArray[2][0] / lonArray[2][1] / 3600
              const longitude = lonRef === 'W' ? -lon : lon

              setValue('longitude', longitude.toFixed(6))
            }

            // Extract altitude if available
            if (gps[piexif.GPSIFD.GPSAltitude]) {
              const alt = gps[piexif.GPSIFD.GPSAltitude]
              const altitude = alt[0] / alt[1]
              console.log('Altitude from photo:', altitude)
            }

            setPhotoMessage('✓ GPS coordinates extracted from photo')
          } else {
            setPhotoMessage('⚠️ No GPS data found in photo. Enable geolocation when taking photos')
          }

          // Store photo for display
          const photoUrl = URL.createObjectURL(file)
          setUploadedPhoto(photoUrl)
        } catch (err) {
          setPhotoMessage('❌ Error reading EXIF data. Try another photo.')
          console.error('EXIF read error:', err)
        }
      }
      reader.readAsArrayBuffer(file)
    } catch (err) {
      setPhotoMessage('❌ Error loading photo: ' + err.message)
    }
  }

  return (
    <div className={`section ${!isExpanded ? 'collapsed' : ''}`}>
      <button
        className="section-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2>Site Information</h2>
        <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
      </button>

      {isExpanded && (
        <div className="section-content">
          <div className="field-group">
            <label>Collector Name</label>
            <input
              type="text"
              placeholder="Your name"
              value={data.collector || ''}
              onChange={(e) => setValue('collector', e.target.value)}
            />
          </div>

          <div className="field-group">
            <label>Site Number</label>
            <div className="point-controls">
              <button className="btn-small" onClick={decrementSite}>-</button>
              <input
                type="number"
                value={data.siteNumber || 1}
                onChange={(e) => {
                  const value = e.target.value
                  const validation = validateSiteNumber(value)
                  setFieldError('siteNumber', validation.valid ? null : validation.message)
                  setValue('siteNumber', parseInt(value) || 1)
                }}
                min="1"
                style={{
                  borderColor: errors.siteNumber ? '#d32f2f' : undefined
                }}
              />
              <button className="btn-small" onClick={incrementSite}>+</button>
            </div>
            {errors.siteNumber && (
              <small style={{ color: '#d32f2f', marginTop: '4px', display: 'block' }}>
                ⚠️ {errors.siteNumber}
              </small>
            )}
          </div>

          <div className="field-group">
            <label>Date</label>
            <input
              type="date"
              value={data.date}
              onChange={(e) => setValue('date', e.target.value)}
            />
          </div>

          <div className="field-group">
            <label>Local Time</label>
            <input
              type="time"
              value={data.localTime}
              onChange={(e) => setValue('localTime', e.target.value)}
            />
          </div>

          <div className="field-group">
            <label>UTC Offset</label>
            <select
              value={data.utcOffset}
              onChange={(e) => setValue('utcOffset', e.target.value)}
            >
              <option value="-12:00">UTC -12:00</option>
              <option value="-11:00">UTC -11:00</option>
              <option value="-10:00">UTC -10:00</option>
              <option value="-09:00">UTC -09:00</option>
              <option value="-08:00">UTC -08:00</option>
              <option value="-07:00">UTC -07:00</option>
              <option value="-06:00">UTC -06:00</option>
              <option value="-05:00">UTC -05:00</option>
              <option value="-04:00">UTC -04:00</option>
              <option value="-03:00">UTC -03:00</option>
              <option value="-02:00">UTC -02:00</option>
              <option value="-01:00">UTC -01:00</option>
              <option value="+00:00">UTC +00:00</option>
              <option value="+01:00">UTC +01:00</option>
              <option value="+02:00">UTC +02:00</option>
              <option value="+03:00">UTC +03:00</option>
              <option value="+04:00">UTC +04:00</option>
              <option value="+05:00">UTC +05:00</option>
              <option value="+06:00">UTC +06:00</option>
              <option value="+07:00">UTC +07:00</option>
              <option value="+08:00">UTC +08:00</option>
              <option value="+09:00">UTC +09:00</option>
              <option value="+10:00">UTC +10:00</option>
              <option value="+11:00">UTC +11:00</option>
              <option value="+12:00">UTC +12:00</option>
            </select>
          </div>

          {/* Photo Upload Section */}
          <div className="field-group">
            <label>📸 Photo for Coordinates (optional)</label>
            <div style={{
              padding: '12px',
              backgroundColor: '#f5f5f5',
              borderRadius: '6px',
              marginBottom: '12px'
            }}>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                style={{
                  padding: '8px',
                  width: '100%',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  marginBottom: '8px'
                }}
              />
              <small style={{ fontSize: '11px', color: '#666', display: 'block', lineHeight: '1.5' }}>
                ⚠️ <strong>IMPORTANT:</strong> Photo must be taken strictly VERTICALLY (top to bottom) with geolocation enabled
              </small>
            </div>
            {photoMessage && (
              <small style={{
                display: 'block',
                marginTop: '8px',
                padding: '8px',
                backgroundColor: photoMessage.includes('✓') ? '#e8f5e9' : photoMessage.includes('⚠️') ? '#fff3e0' : '#ffebee',
                borderRadius: '4px',
                color: photoMessage.includes('✓') ? '#2e7d32' : photoMessage.includes('⚠️') ? '#e65100' : '#c62828'
              }}>
                {photoMessage}
              </small>
            )}
            {uploadedPhoto && (
              <div style={{
                marginTop: '12px',
                textAlign: 'center'
              }}>
                <img
                  src={uploadedPhoto}
                  alt="Uploaded site photo"
                  style={{
                    maxWidth: '200px',
                    maxHeight: '300px',
                    borderRadius: '6px',
                    border: '1px solid #ddd'
                  }}
                />
                <small style={{ display: 'block', marginTop: '8px', color: '#666' }}>
                  Uploaded site photo
                </small>
              </div>
            )}
          </div>

          <div className="field-group">
            <label>GPS Latitude</label>
            <input
              type="number"
              step="0.000001"
              value={data.latitude || ''}
              onChange={(e) => {
                const value = e.target.value
                setValue('latitude', value)
                // Validate both coordinates together
                const validation = validateCoordinates(value, data.longitude)
                setFieldError('coords', validation.valid ? null : validation.message)
              }}
              placeholder="Auto-detected from phone or photo"
              style={{
                borderColor: errors.coords ? '#d32f2f' : undefined
              }}
            />
            <small style={{ fontSize: '12px', color: '#999' }}>Decimal degrees (e.g., 68.356)</small>
          </div>

          <div className="field-group">
            <label>GPS Longitude</label>
            <input
              type="number"
              step="0.000001"
              value={data.longitude || ''}
              onChange={(e) => {
                const value = e.target.value
                setValue('longitude', value)
                // Validate both coordinates together
                const validation = validateCoordinates(data.latitude, value)
                setFieldError('coords', validation.valid ? null : validation.message)
              }}
              placeholder="Auto-detected from phone or photo"
              style={{
                borderColor: errors.coords ? '#d32f2f' : undefined
              }}
            />
            <small style={{ fontSize: '12px', color: '#999' }}>Decimal degrees (e.g., 19.234)</small>
            {errors.coords && (
              <small style={{ color: '#d32f2f', marginTop: '4px', display: 'block' }}>
                ⚠️ {errors.coords}
              </small>
            )}
          </div>

          <div className="field-group">
            <label>GPS Accuracy (m)</label>
            <input
              type="number"
              value={data.accuracy || ''}
              onChange={(e) => setValue('accuracy', parseInt(e.target.value) || '')}
              placeholder="Auto-detected"
              disabled
            />
            <small style={{ fontSize: '12px', color: '#999' }}>Meters - read only</small>
          </div>

          <div className="field-group">
            <label>Shadow Experiment Netting</label>
            <select
              value={data.shadowExperimentNetting || '0'}
              onChange={(e) => setValue('shadowExperimentNetting', e.target.value)}
            >
              <option value="0">0 layers</option>
              <option value="1">1 layer</option>
              <option value="2">2 layers</option>
              <option value="3">3 layers</option>
              <option value="4">4 layers</option>
              <option value="5">5 layers</option>
              <option value="6">6+ layers</option>
            </select>
          </div>

          <div className="field-group">
            <label>Landscape Type</label>
            <div className="autocomplete-container">
              <input
                type="text"
                placeholder="RTS, Polygon, Shore..."
                value={data.landscape}
                onChange={(e) => {
                  const value = e.target.value
                  setValue('landscape', value)

                  // Filter suggestions
                  if (value.length > 0) {
                    const filtered = allLandscapes.filter(l =>
                      l.toLowerCase().includes(value.toLowerCase())
                    )
                    setLandscapeSuggestions(filtered)
                  } else {
                    setLandscapeSuggestions([])
                  }
                }}
              />
              {landscapeSuggestions.length > 0 && (
                <div className="autocomplete-suggestions">
                  {landscapeSuggestions.map((suggestion) => (
                    <div
                      key={suggestion}
                      className="suggestion-item"
                      onClick={() => {
                        setValue('landscape', suggestion)
                        setLandscapeSuggestions([])
                        // Add to history if new
                        if (!allLandscapes.includes(suggestion)) {
                          setAllLandscapes([...allLandscapes, suggestion])
                        }
                      }}
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="field-row-2">
            <div className="field-group">
              <label>Soil Moisture (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={data.soilMoisture || ''}
                onChange={(e) => setValue('soilMoisture', e.target.value ? parseFloat(e.target.value) : '')}
              />
            </div>

            <div className="field-group">
              <label>Soil Temp (°C)</label>
              <input
                type="number"
                step="0.1"
                value={data.soilTemperature || ''}
                onChange={(e) => setValue('soilTemperature', e.target.value ? parseFloat(e.target.value) : '')}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
