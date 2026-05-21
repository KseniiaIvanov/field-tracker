import Papa from 'papaparse'
import { useState } from 'react'
import { downloadOrganizedZip } from '../utils/organizeByDateAndSite'

export default function Export({ entries }) {
  const [expandIndividual, setExpandIndividual] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const exportIndividualEntry = (entry, index) => {
    const filename = `entry_site${entry.siteNumber}_${entry.date}.json`
    const json = JSON.stringify(entry, null, 2)
    downloadFile(json, filename, 'application/json')
  }

  const exportToCSV = () => {
    if (entries.length === 0) {
      alert('No entries to export')
      return
    }

    // Flatten the nested data structure for CSV
    const vegCategories = ['Shrubs', 'Dwarf Shrubs', 'Grass', 'Sedges', 'Green Mosses', 'Sphagnum Mosses', 'Brown Mosses', 'Lichens', 'Bare Peat', 'Litter Standing Dead']
    const flatData = entries.map(entry => {
      const vegCoverage = {}
      vegCategories.forEach(cat => {
        vegCoverage[`Veg_${cat.replace(/ /g, '_')}`] = entry.vegetationShort?.[cat]?.coverage ?? ''
        vegCoverage[`Veg_${cat.replace(/ /g, '_')}_height_cm`] = entry.vegetationShort?.[cat]?.height ?? ''
      })
      return {
        'Site Number': entry.siteNumber,
        'Date': entry.date,
        'Local Time': entry.localTime,
        'UTC Offset': entry.utcOffset,
        'Collector': entry.collector,
        'Latitude': entry.latitude,
        'Longitude': entry.longitude,
        'GPS Accuracy m': entry.accuracy,
        'Landscape': entry.landscape,
        'Disturbance': entry.disturbance,
        'Organic Matter Type': entry.organicMatterType,
        'Environment': entry.terrestrialAquatic,
        'Standing Water': entry.standingWater ? 'yes' : 'no',
        'Standing Water Depth cm': entry.standingWaterDepth || '',
        'Carbon Flux': entry.carbonFluxMeasurement ? 'yes' : 'no',
        'Shadow Netting Layers': entry.shadowExperimentNetting,
        'Cloud Cover %': entry.weather?.cloudCover,
        'Precipitation': entry.weather?.precipitation,
        'Wind Speed m/s': entry.weather?.windSpeed,
        'Wind Direction': entry.weather?.windDirection,
        'Air Temperature C': entry.weather?.temperature,
        'AL Depth 1 cm': entry.alDepth1 ?? '',
        'AL Depth 2 cm': entry.alDepth2 ?? '',
        'AL Depth 3 cm': entry.alDepth3 ?? '',
        'AL Depth avg cm': entry.activeLayerDepth,
        'Organic Layer Depth cm': entry.organicLayerDepth,
        'Soil Temperature C': entry.soilTemperature,
        'Soil Moisture': entry.soilMoisture,
        'Topography': entry.morphology,
        'Water Features': entry.waterFeatures,
        ...vegCoverage,
        'Veg Short Notes': entry.vegetationShortNotes,
        'Notes': entry.notes
      }
    })

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

  const exportOrganizedZip = async () => {
    if (entries.length === 0) {
      alert('No entries to export')
      return
    }
    try {
      setIsExporting(true)
      await downloadOrganizedZip(entries)
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export: ' + error.message)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="export-section">
      <h3>Export Data</h3>
      <div className="export-buttons">
        <button
          className="btn-export"
          onClick={exportOrganizedZip}
          disabled={isExporting}
          title="Download organized backup: Field_Diary_YYYY-MM-DD.zip with folders: Date/Site_###/photos, voice_notes"
          style={{ fontWeight: '700', backgroundColor: isExporting ? '#ccc' : '#2d6a4f', color: 'white' }}
        >
          {isExporting ? '⏳ Organizing...' : '📦 Backup (Organized ZIP)'}
        </button>
        <button
          className="btn-export"
          onClick={exportToCSV}
          title="Export entries as CSV for Excel/spreadsheet analysis"
          style={{ backgroundColor: '#0066cc', color: 'white' }}
        >
          📊 Export to CSV
        </button>
        <button
          className="btn-export"
          onClick={exportToJSON}
          title="Export entries as JSON for R/Python analysis"
          style={{ backgroundColor: '#0066cc', color: 'white' }}
        >
          📋 Export All JSON
        </button>
        <button
          className="btn-export"
          onClick={() => setExpandIndividual(!expandIndividual)}
          title="Download each entry as a separate JSON file"
          style={{ backgroundColor: '#6750a4', color: 'white' }}
        >
          📁 Individual Files ({entries.length})
        </button>
      </div>

      {expandIndividual && entries.length > 0 && (
        <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
          <p style={{ marginTop: 0, marginBottom: '8px', fontWeight: 600 }}>Download individual entries:</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
            {entries.map((entry, index) => (
              <button
                key={index}
                onClick={() => exportIndividualEntry(entry, index)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#6750a4',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  textAlign: 'left'
                }}
              >
                Site {entry.siteNumber} - {entry.date}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="export-info">
        {entries.length > 0 ? (
          <>
            <strong>📦 Organized Backup</strong> creates: <code>Field_Diary_YYYY-MM-DD/→ Date/ → Site_###/</code> with all photos & voice notes<br />
            {entries.length} entries ready to export • CSV for analysis • JSON for archiving
          </>
        ) : (
          'Complete and save entries to enable export'
        )}
      </p>
    </div>
  )
}
