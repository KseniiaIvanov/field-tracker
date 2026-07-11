import { useState, useEffect, useRef } from 'react'

const LANDSCAPE_DEFAULTS = ['RTS', 'Polygon', 'Trench', 'Shore', 'Pond', 'Hummock', 'Palsa', 'Thermokarst', 'Degraded', 'Wet Sedge', 'Dry Moss', 'Mixed']
const ORGANIC_MATTER_TYPES = ['Live vegetation', 'Litter', 'Peat', 'Mixed']

export default function PointInfo({ watch, setValue, previousEntry }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [landscapeSuggestions, setLandscapeSuggestions] = useState([])
  const [allLandscapes] = useState(LANDSCAPE_DEFAULTS)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const recordingIntervalRef = useRef(null)
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
  }, [])

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
        </div>
      </div>

      {isExpanded && (
        <div className="section-content">

          {/* ROW 1: Area + Collar */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div className="field-group">
              <label>Area</label>
              <input type="text" value={data.area || ''} onChange={(e) => setValue('area', e.target.value)} placeholder="Area name / ID" />
            </div>
            <div className="field-group">
              <label>Collar</label>
              <input type="text" value={data.collar || ''} onChange={(e) => setValue('collar', e.target.value)} placeholder="Collar ID" />
            </div>
          </div>

          {/* ROW 2: Date + Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div className="field-group">
              <label style={{ fontSize: '11px' }}>Date</label>
              <input type="date" value={data.date} onChange={(e) => setValue('date', e.target.value)} style={{ fontSize: '12px', padding: '4px' }} />
            </div>
            <div className="field-group">
              <label style={{ fontSize: '11px' }}>Time</label>
              <input type="time" value={data.localTime} onChange={(e) => setValue('localTime', e.target.value)} style={{ fontSize: '12px', padding: '4px' }} />
            </div>
          </div>

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
              <label>Hydrotiles</label>
              <select value={data.hydrotiles || ''} onChange={(e) => setValue('hydrotiles', e.target.value)}>
                <option value="">Select...</option>
                <option value="Up-up">Up-up</option>
                <option value="Up-low">Up-low</option>
                <option value="Low-up">Low-up</option>
                <option value="Low-low">Low-low</option>
              </select>
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

            {/* Collector */}
            <div className="field-group" style={{ marginBottom: '8px' }}>
              <label>Collector</label>
              <input type="text" placeholder="Your name" value={data.collector || ''} onChange={(e) => setValue('collector', e.target.value)} />
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
