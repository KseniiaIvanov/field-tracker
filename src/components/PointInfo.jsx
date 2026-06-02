import { useState, useEffect, useRef } from 'react'
import { validateCoordinates, validateSiteNumber } from '../utils/validation'
import piexif from 'piexifjs'

const LANDSCAPE_DEFAULTS = ['RTS', 'Polygon', 'Trench', 'Shore', 'Pond', 'Hummock', 'Palsa', 'Thermokarst', 'Degraded', 'Wet Sedge', 'Dry Moss', 'Mixed']
const DISTURBANCE_DEFAULTS = ['None', 'Thermokarst', 'Erosion', 'Trampling', 'Slump', 'Other']
const ORGANIC_MATTER_TYPES = ['Live vegetation', 'Litter', 'Peat', 'Mixed']

export default function PointInfo({ control, watch, setValue, previousEntry, gpsAveraging, setGpsAveraging, bluetoothReading, bluetoothError, startBluetoothRead }) {
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
          <h2>Site Info</h2>
          <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
        </button>
        <div style={{ display: 'flex', gap: '6px' }}>
          {previousEntry && (
            <button onClick={copyPointInfoFromPrevious} className="copy-button" style={{ padding: '8px 12px', fontSize: '12px' }}>
              📋 Copy
            </button>
          )}
          <button
            type="button"
            onClick={gpsAveraging ? stopGPSAveraging : startGPSAveraging}
            style={{ padding: '8px 12px', backgroundColor: gpsAveraging ? '#ff6b6b' : 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '12px' }}
          >
            📍 {gpsAveraging ? `Stop (${Math.round((Date.now() - gpsAveraging.startTime) / 1000)}s)` : 'Get GPS'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="section-content">

          {/* ROW 1: Site # + Date + Time (3 columns, 1 row) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '8px', alignItems: 'end' }}>
            <div className="field-group">
              <label>Site #</label>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button onClick={decrementSite} style={{ padding: '8px 10px', fontSize: '16px', fontWeight: 'bold', backgroundColor: '#f0f0f0', color: '#1a1a1a', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer' }}>−</button>
                <input
                  type="number"
                  value={data.siteNumber || 1}
                  onChange={(e) => {
                    const value = e.target.value
                    const validation = validateSiteNumber(value)
                    setFieldError('siteNumber', validation.valid ? null : validation.message)
                    setValue('siteNumber', parseInt(value) || 1)
                  }}
                  min="1" max="999"
                  style={{ width: '52px', textAlign: 'center', fontWeight: '700', padding: '8px', fontSize: '16px', color: '#1a1a1a', backgroundColor: '#fff', border: errors.siteNumber ? '1px solid #d32f2f' : '1px solid #ddd', borderRadius: '6px' }}
                />
                <button onClick={incrementSite} style={{ padding: '8px 10px', fontSize: '16px', fontWeight: 'bold', backgroundColor: '#f0f0f0', color: '#1a1a1a', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer' }}>+</button>
              </div>
            </div>
            <div className="field-group">
              <label>Date</label>
              <input type="date" value={data.date} onChange={(e) => setValue('date', e.target.value)} />
            </div>
            <div className="field-group">
              <label>Time</label>
              <input type="time" value={data.localTime} onChange={(e) => setValue('localTime', e.target.value)} />
            </div>
          </div>


          {gpsAveraging && (
            <div style={{ height: '4px', backgroundColor: '#e0e0e0', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${gpsAveraging.progress}%`, height: '100%', backgroundColor: '#4CAF50', transition: 'width 0.3s ease' }} />
            </div>
          )}

          {/* ROW 4: Lat + Lon */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div className="field-group">
              <label>Latitude</label>
              <input type="number" step="0.000001" value={data.latitude || ''} placeholder="68.356..." onChange={(e) => { setValue('latitude', e.target.value); setFieldError('coords', validateCoordinates(e.target.value, data.longitude).valid ? null : validateCoordinates(e.target.value, data.longitude).message) }} style={{ borderColor: errors.coords ? '#d32f2f' : undefined }} />
            </div>
            <div className="field-group">
              <label>Longitude</label>
              <input type="number" step="0.000001" value={data.longitude || ''} placeholder="19.234..." onChange={(e) => { setValue('longitude', e.target.value); setFieldError('coords', validateCoordinates(data.latitude, e.target.value).valid ? null : validateCoordinates(data.latitude, e.target.value).message) }} style={{ borderColor: errors.coords ? '#d32f2f' : undefined }} />
            </div>
          </div>
          {errors.coords && <small style={{ color: '#d32f2f', fontSize: '11px' }}>⚠️ {errors.coords}</small>}
          {data.accuracy && <small style={{ color: '#666', fontSize: '11px' }}>GPS accuracy: {data.accuracy}m</small>}

          {/* ROW 5: Landscape + Organic matter */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div className="field-group">
              <label>Landscape</label>
              <div className="autocomplete-container">
                <input
                  type="text"
                  placeholder="RTS, Polygon..."
                  value={data.landscape}
                  onChange={(e) => {
                    setValue('landscape', e.target.value)
                    setLandscapeSuggestions(e.target.value.length > 0 ? allLandscapes.filter(l => l.toLowerCase().includes(e.target.value.toLowerCase())) : [])
                  }}
                />
                {landscapeSuggestions.length > 0 && (
                  <div className="autocomplete-suggestions">
                    {landscapeSuggestions.map((s) => (
                      <div key={s} className="suggestion-item" onClick={() => { setValue('landscape', s); setLandscapeSuggestions([]) }}>{s}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="field-group">
              <label>Organic Matter</label>
              <select value={data.organicMatterType || ''} onChange={(e) => setValue('organicMatterType', e.target.value)}>
                <option value="">Select...</option>
                {ORGANIC_MATTER_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
          </div>

          {/* ROW 6: Disturbances + Notes (2 columns, 1 row) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div className="field-group">
              <label>Disturbances</label>
              <input
                type="text"
                value={data.disturbance || ''}
                onChange={(e) => setValue('disturbance', e.target.value)}
                maxLength="60"
              />
            </div>

            <div className="field-group">
              <label>Notes</label>
              <textarea
                value={data.notes || ''}
                onChange={(e) => setValue('notes', e.target.value)}
                placeholder="Observations, conditions, features..."
                rows="2"
                style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* ROW 8: Photo + Voice in one row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="field-group">
              <label>📷 Photo</label>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'inline-block', padding: '8px 10px', backgroundColor: 'var(--primary-color)', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', flexShrink: 0 }}>
                  📸
                  <input type="file" accept="image/*" capture="environment" onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const reader = new FileReader()
                      reader.onloadend = () => setValue('entryPhotos', [...(data.entryPhotos || []), { id: Date.now(), originalData: reader.result, previewData: reader.result, name: file.name, type: file.type }])
                      reader.readAsDataURL(file)
                    }
                    e.target.value = ''
                  }} style={{ display: 'none' }} />
                </label>
                <label style={{ display: 'inline-block', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', flexShrink: 0 }}>
                  📷
                  <input type="file" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const reader = new FileReader()
                      reader.onloadend = () => setValue('entryPhotos', [...(data.entryPhotos || []), { id: Date.now(), originalData: reader.result, previewData: reader.result, name: file.name, type: file.type }])
                      reader.readAsDataURL(file)
                    }
                    e.target.value = ''
                  }} style={{ display: 'none' }} />
                </label>
                {(data.entryPhotos || []).map((photo) => (
                  <div key={photo.id} style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', width: '48px', height: '48px', flexShrink: 0 }}>
                    <img src={photo.previewData || photo.originalData} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button onClick={() => setValue('entryPhotos', (data.entryPhotos || []).filter(p => p.id !== photo.id))} style={{ position: 'absolute', top: '1px', right: '1px', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '16px', height: '16px', cursor: 'pointer', fontSize: '10px', padding: 0, lineHeight: '16px', textAlign: 'center' }}>✕</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="field-group">
              <label>🎤 Voice</label>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  style={{ padding: '8px 12px', backgroundColor: isRecording ? '#d32f2f' : '#f0f0f0', color: isRecording ? 'white' : '#1a1a1a', border: '1px solid #ddd', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}
                >
                  {isRecording ? `⏹ ${recordingTime}s` : '🎤 Rec'}
                </button>
                {voiceNotes.map((note) => (
                  <div key={note.id} style={{ display: 'flex', gap: '2px', alignItems: 'center', padding: '3px 6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px' }}>
                    <button type="button" onClick={() => playVoiceNote(note.data)} style={{ padding: '3px 6px', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>▶ {note.duration}s</button>
                    <button type="button" onClick={() => deleteVoiceNote(note.id)} style={{ padding: '1px 4px', backgroundColor: 'transparent', color: '#999', border: 'none', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SEPARATOR - Rarely changed fields */}
          <div style={{ borderTop: '2px dashed #ddd', paddingTop: '16px', marginTop: '8px' }}>
            <p style={{ fontSize: '11px', color: '#aaa', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Less frequent</p>

            {/* Carbon Flux */}
            <div className="field-group" style={{ marginBottom: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={data.carbonFluxMeasurement || false} onChange={(e) => setValue('carbonFluxMeasurement', e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                Carbon flux measurement
              </label>
            </div>

            {/* UTC + Shadow in 2 cols */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div className="field-group">
                <label>UTC Offset</label>
                <select value={data.utcOffset} onChange={(e) => setValue('utcOffset', e.target.value)} style={{ fontSize: '12px' }}>
                  {['-12:00','-11:00','-10:00','-09:00','-08:00','-07:00','-06:00','-05:00','-04:00','-03:00','-02:00','-01:00','+00:00','+01:00','+02:00','+03:00','+04:00','+05:00','+06:00','+07:00','+08:00','+09:00','+10:00','+11:00','+12:00'].map(o => <option key={o} value={o}>UTC {o}</option>)}
                </select>
              </div>
              <div className="field-group">
                <label>Shadow Netting</label>
                <select value={data.shadowExperimentNetting || '0'} onChange={(e) => setValue('shadowExperimentNetting', e.target.value)} style={{ fontSize: '12px' }}>
                  {['0','1','2','3','4','5','6'].map(n => <option key={n} value={n}>{n === '6' ? '6+ layers' : `${n} layer${n === '1' ? '' : 's'}`}</option>)}
                </select>
              </div>
            </div>

            {/* Collector + Coord photo */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div className="field-group">
                <label>Collector</label>
                <input type="text" placeholder="Your name" value={data.collector || ''} onChange={(e) => setValue('collector', e.target.value)} />
              </div>
              <div className="field-group">
                <label>📸 Coord Photo</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'inline-block', padding: '8px 10px', backgroundColor: 'var(--primary-color)', color: 'white', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                    📸
                    <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                  </label>
                  <label style={{ display: 'inline-block', padding: '8px 10px', backgroundColor: '#f0f0f0', color: '#1a1a1a', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                    📷
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                  </label>
                  {photoMessage && <small style={{ display: 'block', width: '100%', marginTop: '4px', fontSize: '11px', color: photoMessage.includes('✓') ? '#2e7d32' : '#c62828' }}>{photoMessage}</small>}
                </div>
              </div>
            </div>

            {uploadedPhoto && (
              <img src={uploadedPhoto} alt="Coord photo" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #ddd' }} />
            )}
          </div>

        </div>
      )}
    </div>
  )
}
