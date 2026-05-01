import Papa from 'papaparse'

export default function Export({ entries }) {
  const exportToCSV = () => {
    if (entries.length === 0) {
      alert('No entries to export')
      return
    }

    // Flatten the nested data structure for CSV
    const flatData = entries.map(entry => ({
      'Site Number': entry.siteNumber,
      'Date': entry.date,
      'Local Time': entry.localTime,
      'UTC Offset': entry.utcOffset,
      'Landscape': entry.landscape,
      'Environment': entry.terrestrialAquatic,
      'Cloud Cover %': entry.weather?.cloudCover,
      'Precipitation': entry.weather?.precipitation,
      'Wind Speed m/s': entry.weather?.windSpeed,
      'Wind Direction': entry.weather?.windDirection,
      'Air Temperature C': entry.weather?.temperature,
      'Active Layer Depth cm': entry.activeLayerDepth,
      'Organic Layer Depth cm': entry.organicLayerDepth,
      'Soil Temperature C': entry.soilTemperature,
      'Soil Moisture': entry.soilMoisture,
      'Morphology': entry.morphology,
      'Slope Angle deg': entry.slopeAngle,
      'Aspect': entry.aspect,
      'Notes': entry.notes
    }))

    const csv = Papa.unparse(flatData)
    downloadFile(csv, 'field-diary.csv', 'text/csv')
  }

  const exportToJSON = () => {
    if (entries.length === 0) {
      alert('No entries to export')
      return
    }

    const json = JSON.stringify(entries, null, 2)
    downloadFile(json, 'field-diary.json', 'application/json')
  }

  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="export-section">
      <h3>Export Data</h3>
      <div className="export-buttons">
        <button
          className="btn-export"
          onClick={exportToCSV}
          title="Export entries as CSV for Excel/spreadsheet analysis"
        >
          📊 Export to CSV
        </button>
        <button
          className="btn-export"
          onClick={exportToJSON}
          title="Export entries as JSON for R/Python analysis"
        >
          📋 Export to JSON
        </button>
      </div>
      <p className="export-info">
        {entries.length > 0
          ? `${entries.length} entries ready to export`
          : 'Complete and save entries to enable export'}
      </p>
    </div>
  )
}
