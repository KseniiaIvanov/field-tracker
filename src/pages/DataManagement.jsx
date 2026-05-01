import { useState } from 'react'
import Papa from 'papaparse'

export default function DataManagement({ setCurrentPage, allEntries }) {
  const [viewMode, setViewMode] = useState('list') // list, table

  const exportToCSV = () => {
    if (allEntries.length === 0) {
      alert('No entries to export')
      return
    }

    const flatData = allEntries.map(entry => ({
      'Site Number': entry.siteNumber,
      'Date': entry.date,
      'Local Time': entry.localTime,
      'UTC Offset': entry.utcOffset,
      'Landscape': entry.landscape,
      'Environment': entry.terrestrialAquatic,
      'Cloud Cover %': entry.weather?.cloudCover,
      'Precipitation': entry.weather?.precipitation,
      'Wind Speed m/s': entry.weather?.windSpeed,
      'Air Temperature C': entry.weather?.temperature,
      'Active Layer Depth cm': entry.activeLayerDepth,
      'Soil Temperature C': entry.soilTemperature,
      'Soil Moisture': entry.soilMoisture,
      'Morphology': entry.morphology
    }))

    const csv = Papa.unparse(flatData)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `field-diary-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const exportToJSON = () => {
    if (allEntries.length === 0) {
      alert('No entries to export')
      return
    }

    const json = JSON.stringify(allEntries, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `field-diary-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="page-content">
      <button className="btn-back" onClick={() => setCurrentPage('home')}>← Back to Menu</button>

      <h2>Data Management</h2>

      <div className="section">
        <h3>Export Data</h3>
        <div className="export-buttons-row">
          <button className="btn-export" onClick={exportToCSV}>
            📊 Export to CSV
          </button>
          <button className="btn-export" onClick={exportToJSON}>
            📋 Export to JSON
          </button>
        </div>
        <p className="info-text">{allEntries.length} entries available for export</p>
      </div>

      <div className="section">
        <h3>Entries Overview</h3>
        <div className="view-controls">
          <button
            className={`btn-view ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            📋 List View
          </button>
          <button
            className={`btn-view ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
          >
            📊 Table View
          </button>
        </div>

        {allEntries.length === 0 ? (
          <p className="info-text">No entries recorded yet. Start with Field Diary!</p>
        ) : viewMode === 'list' ? (
          <div className="entries-list">
            {allEntries.map((entry, idx) => (
              <div key={idx} className="entry-item">
                <div className="entry-header">
                  <strong>Site {entry.siteNumber}</strong>
                  <span className="entry-date">{entry.date}</span>
                </div>
                <div className="entry-details">
                  <span>{entry.landscape}</span>
                  <span>{entry.terrestrialAquatic}</span>
                  <span>{entry.weather?.precipitation || 'No rain'}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="entries-table">
            <table>
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Landscape</th>
                  <th>Env.</th>
                  <th>Temp (°C)</th>
                </tr>
              </thead>
              <tbody>
                {allEntries.map((entry, idx) => (
                  <tr key={idx}>
                    <td>{entry.siteNumber}</td>
                    <td>{entry.date}</td>
                    <td>{entry.localTime}</td>
                    <td>{entry.landscape}</td>
                    <td>{entry.terrestrialAquatic[0].toUpperCase()}</td>
                    <td>{entry.weather?.temperature || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="section info-section">
        <h3>Storage Info</h3>
        <p>Total entries: <strong>{allEntries.length}</strong></p>
        <p>Data is stored locally on your device</p>
      </div>
    </div>
  )
}
