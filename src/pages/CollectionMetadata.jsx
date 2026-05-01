import { useState, useEffect } from 'react'
import localforage from 'localforage'

export default function CollectionMetadata({ setCurrentPage }) {
  const [metadata, setMetadata] = useState({
    collector: '',
    method: '',
    date: new Date().toISOString().split('T')[0],
    institution: '',
    notes: ''
  })

  const [todayDate] = useState(new Date().toISOString().split('T')[0])

  // Load metadata for today
  useEffect(() => {
    const loadMetadata = async () => {
      const saved = await localforage.getItem('dailyMetadata')
      if (saved && saved.date === todayDate) {
        setMetadata(saved)
      } else {
        setMetadata({
          collector: '',
          method: '',
          date: todayDate,
          institution: '',
          notes: ''
        })
      }
    }
    loadMetadata()
  }, [todayDate])

  const saveMetadata = async () => {
    await localforage.setItem('dailyMetadata', metadata)
    alert('Collection metadata saved! It will apply to all sites today.')
    setCurrentPage('diary')
  }

  const updateMetadata = (field, value) => {
    setMetadata({ ...metadata, [field]: value })
  }

  return (
    <div className="page-content">
      <button className="btn-back" onClick={() => setCurrentPage('diary')}>← Back</button>

      <h2>Collection Metadata</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
        These details will apply to all sites recorded today ({todayDate})
      </p>

      <div className="section">
        <h3>Collector Information</h3>

        <div className="field-group">
          <label>Collector Name *</label>
          <input
            type="text"
            placeholder="Your name"
            value={metadata.collector}
            onChange={(e) => updateMetadata('collector', e.target.value)}
          />
        </div>

        <div className="field-group">
          <label>Institution/Organization</label>
          <input
            type="text"
            placeholder="e.g., University, Research Station"
            value={metadata.institution}
            onChange={(e) => updateMetadata('institution', e.target.value)}
          />
        </div>
      </div>

      <div className="section">
        <h3>Sampling Method</h3>

        <div className="field-group">
          <label>Method *</label>
          <select
            value={metadata.method}
            onChange={(e) => updateMetadata('method', e.target.value)}
          >
            <option value="">-- Select method --</option>
            <option value="systematic">Systematic grid</option>
            <option value="random">Random sampling</option>
            <option value="stratified">Stratified sampling</option>
            <option value="transect">Transect walk</option>
            <option value="opportunistic">Opportunistic</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="field-group">
          <label>Additional Notes</label>
          <textarea
            placeholder="e.g., weather conditions, equipment used, any issues..."
            value={metadata.notes}
            onChange={(e) => updateMetadata('notes', e.target.value)}
            rows="4"
          />
        </div>
      </div>

      <div className="section info-section">
        <h3>Date</h3>
        <p><strong>{todayDate}</strong></p>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: 'var(--spacing-sm)' }}>
          All sites recorded today will have this date
        </p>
      </div>

      <button
        className="btn-save-entry"
        onClick={saveMetadata}
        style={{ marginTop: 'var(--spacing-lg)', width: '100%' }}
      >
        Save Metadata & Continue
      </button>
    </div>
  )
}
