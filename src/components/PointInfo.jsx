import { useState, useEffect, useRef } from 'react'
import { validateCoordinates, validateSiteNumber } from '../utils/validation'
import piexif from 'piexifjs'

const LANDSCAPE_DEFAULTS = ['RTS', 'Polygon', 'Trench', 'Shore', 'Pond', 'Hummock', 'Palsa', 'Thermokarst', 'Degraded', 'Wet Sedge', 'Dry Moss', 'Mixed']
const DISTURBANCE_DEFAULTS = ['None', 'Thermokarst', 'Erosion', 'Trampling', 'Slump', 'Other']
const ORGANIC_MATTER_TYPES = ['Live vegetation', 'Litter', 'Peat', 'Mixed']

export default function PointInfo({ control, watch, setValue, previousEntry, gpsAveraging, setGpsAveraging }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [landscapeSuggestions, setLandscapeSuggestions] = useState([])
  const [allLandscapes, setAllLandscapes] = useState(LANDSCAPE_DEFAULTS)
  const [disturbanceSuggestions, setDisturbanceSuggestions] = useState([])
  const [errors, setErrors] = useState({})
  const [uploadedPhoto, setUploadedPhoto] = useState(null)
  const [photoMessage, setPhotoMessage] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const recordingIntervalRef = useRef(null)
  const gpsWatchIdRef = useRef(null)
  const data = watch()
  const voiceNotes = data.voiceNotes || []

  const copyPointInfoFromPrevious = () => {
    if (previousEntry) {
      setValue('collector', previousEntry.collector)
      setValue('landscape', previousEntry.landscape)
      setValue('soilMoisture', previousEntry.soilMoisture)
      setValue('soilTemperature', previousEntry.soilTemperature)
      setValue('terrestrialAquatic', previousEntry.terrestrialAquatic)
      setValue('shadowExperimentNetting', previousEntry.shadowExperimentNetting)
      alert('✓ Site info copied from previous entry')
    }
  }

  const setFieldError = (field, error) => {
    setErrors(prev => ({
      ...prev,
      [field]: error
    }))
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      setRecordingTime(0)
      setIsRecording(true)

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.onloadend = () => {
          const newVoiceNote = {
            id: Date.now(),
            data: reader.result,
            duration: recordingTime,
            timestamp: new Date().toLocaleTimeString()
          }
          setValue('voiceNotes', [...voiceNotes, newVoiceNote])
        }
        reader.readAsDataURL(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()

      // Timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (err) {
      alert('❌ Microphone access denied. Enable in settings.')
      console.error('Mic error:', err)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
    }
  }

  const deleteVoiceNote = (id) => {
    setValue('voiceNotes', voiceNotes.filter(note => note.id !== id))
  }

  const playVoiceNote = (audioData) => {
    const audio = new Audio(audioData)
    audio.play()
  }

  // Auto-fill current time on mount
  useEffect(() => {
    const now = new Date()

    // Auto-fill time if not set
    if (!data.localTime) {
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      setValue('localTime', `${hours}:${minutes}`)
    }

    // Cleanup GPS watch when component unmounts
    return () => {
      if (gpsWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current)
        gpsWatchIdRef.current = null
      }
    }
  }, [])

  // Get GPS coordinates with high accuracy + averaging over 2 minutes (continues in background)
  const startGPSAveraging = () => {
    if (!('geolocation' in navigator)) {
      alert('❌ Geolocation not supported on this device')
      return
    }

    if (gpsAveraging) {
      alert('⏳ Already collecting GPS data. Please wait or click "Stop GPS".')
      return
    }

    // Initialize GPS averaging state
    setGpsAveraging({
      startTime: Date.now(),
      readings: [],
      status: '📍 Collecting GPS readings (stand still)...',
      progress: 0
    })

    const readings = []
    let watchId = null

    const handlePosition = (position) => {
      readings.push({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy: position.coords.accuracy
      })

      // Update state with new reading
      setGpsAveraging(prev => ({
        ...prev,
        readings
      }))
    }

    const handleError = (error) => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
      setGpsAveraging(null)
      gpsWatchIdRef.current = null
      alert(`❌ GPS error: ${error.message}. Enable location in settings.`)
      console.log('GPS error:', error)
    }

    try {
      // Start collecting with high accuracy
      watchId = navigator.geolocation.watchPosition(
        handlePosition,
        handleError,
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 5000
        }
      )
      gpsWatchIdRef.current = watchId
    } catch (err) {
      setGpsAveraging(null)
      alert(`❌ Error: ${err.message}`)
    }
  }

  const stopGPSAveraging = () => {
    if (!gpsAveraging) return

    if (gpsWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current)
      gpsWatchIdRef.current = null
    }

    const readings = gpsAveraging.readings
    if (readings.length === 0) {
      alert('❌ No GPS readings collected. Check signal strength.')
      setGpsAveraging(null)
      return
    }

    // Calculate average coordinates
    const avgLat = readings.reduce((sum, r) => sum + r.lat, 0) / readings.length
    const avgLon = readings.reduce((sum, r) => sum + r.lon, 0) / readings.length
    const minAccuracy = Math.round(Math.min(...readings.map(r => r.accuracy)))

    setValue('latitude', avgLat.toFixed(6))
    setValue('longitude', avgLon.toFixed(6))
    setValue('accuracy', minAccuracy)

    setGpsAveraging(null)
  }

  const incrementSite = () => {
    setValue('siteNumber', (data.siteNumber || 1) + 1)
  }

  const decrementSite = () => {
    setValue('siteNumber', Math.max(1, (data.siteNumber || 1) - 1))
  }

  const copyCoordinatesFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const coords = text.match(/([-\d.]+)[,\s]+([-\d.]+)/)
      if (coords) {
        setValue('latitude', parseFloat(coords[1]).toFixed(6))
        setValue('longitude', parseFloat(coords[2]).toFixed(6))
        alert('✓ Координаты скопированы')
      } else {
        alert('❌ Формат не распознан. Используй: LAT,LON')
      }
    } catch (err) {
      alert('❌ Доступ к буферу обмена запрещен')
    }
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
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          className="section-header"
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ flex: 1 }}
        >
          <h2>Site Information</h2>
          <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
        </button>
        {previousEntry && (
          <button onClick={copyPointInfoFromPrevious} className="copy-button" style={{ margin: '10px 12px', marginLeft: '0' }}>
            📋 Copy
          </button>
        )}
      </div>

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
            <div className="point-controls" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className="btn-small"
                onClick={decrementSite}
                style={{ padding: '10px 14px', fontSize: '16px', fontWeight: 'bold', minWidth: '40px', cursor: 'pointer' }}
              >
                −
              </button>
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
                max="999"
                style={{
                  borderColor: errors.siteNumber ? '#d32f2f' : '#ddd',
                  width: '120px',
                  textAlign: 'center',
                  fontWeight: '600',
                  padding: '10px 8px',
                  fontSize: '16px',
                  color: '#1a1a1a',
                  backgroundColor: '#fff',
                  border: '1px solid #ddd',
                  borderRadius: '6px'
                }}
              />
              <button
                className="btn-small"
                onClick={incrementSite}
                style={{ padding: '10px 14px', fontSize: '16px', fontWeight: 'bold', minWidth: '40px', cursor: 'pointer' }}
              >
                +
              </button>
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

          <div className="shortcut-buttons">
            <button
              type="button"
              onClick={gpsAveraging ? stopGPSAveraging : startGPSAveraging}
              disabled={false}
              className="shortcut-button"
              style={{
                backgroundColor: gpsAveraging ? '#ff6b6b' : undefined,
                opacity: 1,
                cursor: 'pointer'
              }}
            >
              📍 {gpsAveraging ? 'Stop GPS' : 'GPS'}
            </button>
            <button
              type="button"
              onClick={copyCoordinatesFromClipboard}
              className="shortcut-button"
              title="Paste lat,lon from clipboard"
            >
              📋 Paste Coords
            </button>
          </div>

          {gpsAveraging && (
            <div style={{ marginBottom: '12px' }}>
              <small style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '4px' }}>
                {gpsAveraging.status}
              </small>
              <div style={{
                width: '100%',
                height: '6px',
                backgroundColor: '#e0e0e0',
                borderRadius: '3px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${gpsAveraging.progress}%`,
                  height: '100%',
                  backgroundColor: '#4CAF50',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          )}

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
              placeholder="Tap 'Get GPS' or enter manually"
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
              placeholder="Tap 'Get GPS' or enter manually"
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
            <label>GPS Location</label>
            <select
              value={data.gpsLocationNote || 'not_needed'}
              onChange={(e) => setValue('gpsLocationNote', e.target.value)}
            >
              <option value="not_needed">✓ No correction (phone on measurement point)</option>
              <option value="visual_correction_needed">⚠️ Visual correction needed (phone on different surface)</option>
            </select>
            <small style={{ fontSize: '12px', color: '#999' }}>Was phone on same surface as measurements?</small>
          </div>

          <div className="field-group">
            <label>GPS Notes</label>
            <input
              type="text"
              placeholder="e.g., signal weak, tree cover, distance from point..."
              value={data.gpsNotes || ''}
              onChange={(e) => setValue('gpsNotes', e.target.value)}
            />
            <small style={{ fontSize: '12px', color: '#999' }}>Add any notes about GPS accuracy or location</small>
          </div>

          <div className="field-group">
            <label>📝 Site Notes (Quick)</label>
            <textarea
              value={data.notes || ''}
              onChange={(e) => setValue('notes', e.target.value)}
              placeholder="Unusual features, observations, field conditions..."
              rows="3"
              style={{
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '10px 12px',
                fontFamily: 'inherit',
                width: '100%',
                boxSizing: 'border-box'
              }}
            />
            <small style={{ fontSize: '12px', color: '#999' }}>Add immediately - don't wait until end of form</small>
          </div>

          {/* VOICE NOTES */}
          <div className="field-group">
            <label>🎤 Voice Notes</label>
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: isRecording ? '#d32f2f' : 'var(--primary-color)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isRecording ? (
                <>
                  <span style={{ fontSize: '18px' }}>⏹</span>
                  <span>STOP ({recordingTime}s)</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '18px' }}>🎤</span>
                  <span>RECORD NOTE</span>
                </>
              )}
            </button>

            {voiceNotes.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {voiceNotes.map((note) => (
                  <div
                    key={note.id}
                    style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center',
                      padding: '10px 12px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '6px'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => playVoiceNote(note.data)}
                      style={{
                        padding: '6px 10px',
                        backgroundColor: 'var(--primary-color)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '600',
                        minWidth: '50px'
                      }}
                    >
                      ▶ {note.duration}s
                    </button>
                    <span style={{ fontSize: '12px', color: '#999', flex: 1 }}>
                      {note.timestamp}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteVoiceNote(note.id)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#d32f2f',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
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

          <div className="field-group">
            <label>Surface Disturbances</label>
            <input
              type="text"
              placeholder="e.g., thermokarst, erosion, trampling, slumping..."
              value={data.disturbance || ''}
              onChange={(e) => setValue('disturbance', e.target.value)}
              maxLength="60"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                color: '#1a1a1a',
                backgroundColor: '#fff',
                border: '1px solid #ddd',
                borderRadius: '6px'
              }}
            />
            <small style={{ fontSize: '12px', color: '#999', marginTop: '4px', display: 'block' }}>e.g., "none", "thermokarst", "erosion", "trampling", "solifluction"</small>
          </div>

          <div className="field-group">
            <label>Dominant Organic Matter Type</label>
            <select
              value={data.organicMatterType || ''}
              onChange={(e) => setValue('organicMatterType', e.target.value)}
            >
              <option value="">Select type...</option>
              {ORGANIC_MATTER_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <small style={{ fontSize: '12px', color: '#999' }}>Controls decomposition rates and gas flux</small>
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
