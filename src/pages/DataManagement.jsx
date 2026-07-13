import Papa from 'papaparse'
import { entryLabel } from '../utils/entryLabel'

export default function DataManagement({ setCurrentPage, allEntries }) {
  const exportToCSV = () => {
    if (allEntries.length === 0) {
      alert('No entries to export')
      return
    }

    // Union of all vegetation categories across entries (incl. custom ones)
    const vegCategories = Array.from(
      allEntries.reduce((set, e) => {
        if (e.vegetationShort) Object.keys(e.vegetationShort).forEach(c => set.add(c))
        return set
      }, new Set())
    )

    const flatData = allEntries.map(entry => {
      const row = {
        'Site Number': entry.siteNumber,
        'Area': entry.area,
        'Collar': entry.collar,
        'Date': entry.date,
        'Local Time': entry.localTime,
        'UTC Offset': entry.utcOffset,
        'Collector': entry.collector,
        'Latitude': entry.latitude,
        'Longitude': entry.longitude,
        'GPS Accuracy (m)': entry.accuracy,
        'Landscape': entry.landscape,
        'Hydrotiles': entry.hydrotiles,
        'Organic Matter': entry.organicMatterType,
        'Environment': entry.terrestrialAquatic,
        'Cloud Cover (%)': entry.weather?.cloudCover,
        'Precipitation': entry.weather?.precipitation,
        'Wind': entry.weather?.wind,
        'Wind Speed (m/s)': entry.weather?.windSpeed,
        'Wind Direction': entry.weather?.windDirection,
        'Air Temperature (C)': entry.weather?.temperature,
        'Air Humidity (%)': entry.weather?.humidity,
        'Soil Temperature (C)': entry.soilTemperature,
        'Soil Moisture (%)': entry.soilMoisture,
        'Moisture Type': entry.soilMoistureType,
        'Active Layer Depth (cm)': entry.activeLayerDepth,
        'AL Depth 1 (cm)': entry.alDepth1,
        'AL Depth 2 (cm)': entry.alDepth2,
        'AL Depth 3 (cm)': entry.alDepth3,
        'Standing Water': entry.standingWater ? 'yes' : 'no',
        'Standing Water Depth (cm)': entry.standingWaterDepth,
        'Topography': entry.morphology,
        'Disturbance': entry.disturbance,
        'Water Features': entry.waterFeatures,
        'Morphology Notes': entry.morphologyNotes,
        'Carbon Flux Measurement': entry.carbonFluxMeasurement ? 'yes' : 'no',
        'Shadow Netting (layers)': entry.shadowExperimentNetting,
        'Notes': entry.notes
      }
      vegCategories.forEach(cat => {
        const v = entry.vegetationShort?.[cat]
        row[`Veg ${cat} (0-2)`] = v?.coverage ?? ''
        row[`Veg ${cat} height (cm)`] = v?.height ?? ''
      })
      row['Vegetation Notes'] = entry.vegetationShortNotes
      row['Photos'] = (entry.entryPhotos?.length || 0) + (entry.vegetationShortPhotos?.length || 0) + (entry.vegetationLongPhotos?.length || 0)
      row['Voice Notes'] = entry.voiceNotes?.length || 0
      row['Entry Duration (s)'] = entry.entryDurationSeconds ?? ''
      return row
    })

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

        {allEntries.length === 0 ? (
          <p className="info-text">No entries recorded yet. Start with Field Diary!</p>
        ) : (
          <div className="entries-list">
            {allEntries.map((entry, idx) => (
              <div key={idx} className="entry-item">
                <div className="entry-header">
                  <strong>{entryLabel(entry)}</strong>
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
