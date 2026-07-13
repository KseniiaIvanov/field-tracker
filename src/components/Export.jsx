import Papa from 'papaparse'
import { useState } from 'react'
import { downloadOrganizedZip } from '../utils/organizeByDateAndSite'
import { entryLabel, entrySlug } from '../utils/entryLabel'

export default function Export({ entries }) {
  const [expandIndividual, setExpandIndividual] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const exportIndividualEntry = (entry) => {
    const filename = `entry_${entrySlug(entry)}_${entry.date}.json`
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
    <div style={{ marginTop: '8px' }}>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>
        {entries.length > 0 ? `${entries.length} entries saved` : 'No entries yet'}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <button
          onClick={exportOrganizedZip}
          disabled={isExporting}
          style={{ padding: '10px 8px', fontWeight: '700', backgroundColor: isExporting ? '#ccc' : '#2d6a4f', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}
        >
          {isExporting ? '⏳ Packing...' : '📦 Backup ZIP'}
        </button>
        <button
          onClick={exportToCSV}
          style={{ padding: '10px 8px', backgroundColor: '#0066cc', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
        >
          📊 CSV
        </button>
        <button
          onClick={exportToJSON}
          style={{ padding: '10px 8px', backgroundColor: '#0066cc', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
        >
          📋 All JSON
        </button>
        <button
          onClick={() => setExpandIndividual(!expandIndividual)}
          style={{ padding: '10px 8px', backgroundColor: '#6750a4', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
        >
          📁 Files ({entries.length})
        </button>
      </div>

      {expandIndividual && entries.length > 0 && (
        <div style={{ marginTop: '8px', padding: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {entries.map((entry, index) => (
              <button
                key={index}
                onClick={() => exportIndividualEntry(entry, index)}
                style={{ padding: '7px 10px', backgroundColor: '#6750a4', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', textAlign: 'left' }}
              >
                {entryLabel(entry)} · {entry.date}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
