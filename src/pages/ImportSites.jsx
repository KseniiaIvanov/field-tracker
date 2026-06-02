import { useState, useRef } from 'react'
import localforage from 'localforage'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { useNotificationContext } from '../context/NotificationContext'

export default function ImportSites({ setCurrentPage, onSitesImported }) {
  const { showError, showSuccess, showWarning } = useNotificationContext()

  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [columnMapping, setColumnMapping] = useState({
    latitude: '',
    longitude: '',
    accuracy: '',
    date: '',
    siteNumber: '',
    landscape: '',
    soilMoisture: '',
    soilTemperature: ''
  })

  const fileInputRef = useRef(null)

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files?.[0]
    if (!uploadedFile) return

    // Reset input so same file can be re-selected
    e.target.value = ''

    setLoading(true)
    setError(null)

    try {
      let data = []

      // Detect type by both extension AND mime type (Android sometimes changes these)
      const name = uploadedFile.name.toLowerCase()
      const mime = uploadedFile.type.toLowerCase()
      const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls') ||
        mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('ms-excel')
      const isCsv = name.endsWith('.csv') || mime.includes('csv') ||
        mime === 'text/plain' || mime === ''

      if (isExcel) {
        // Parse Excel
        const buffer = await uploadedFile.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        data = XLSX.utils.sheet_to_json(sheet)
      } else if (isCsv) {
        // Parse CSV (also handles text/plain files from Android)
        const text = await uploadedFile.text()
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
        if (parsed.errors.length > 0 && data.length === 0) {
          throw new Error(`CSV parse error: ${parsed.errors[0].message}`)
        }
        data = parsed.data.filter(row => Object.values(row).some(v => v))
      } else {
        // Last resort: try CSV anyway
        try {
          const text = await uploadedFile.text()
          const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
          data = parsed.data.filter(row => Object.values(row).some(v => v))
          if (data.length === 0) throw new Error('empty')
        } catch {
          throw new Error(`Unsupported format: "${uploadedFile.name}" (type: "${uploadedFile.type || 'unknown'}"). Use CSV or Excel.`)
        }
      }

      if (data.length === 0) {
        throw new Error('No data found in file')
      }

      // Show preview and detect columns
      setPreview(data.slice(0, 5))
      setFile(uploadedFile)

      // Auto-detect columns
      const firstRow = data[0]
      const keys = Object.keys(firstRow)
      const mapping = { ...columnMapping }

      // Try to auto-detect common column names
      keys.forEach(key => {
        const lower = key.toLowerCase()
        if (lower.includes('lat') && !mapping.latitude) mapping.latitude = key
        if (lower.includes('lon') && !mapping.longitude) mapping.longitude = key
        if (lower.includes('acc') && !mapping.accuracy) mapping.accuracy = key
        if (lower.includes('date') && !mapping.date) mapping.date = key
        if (lower.includes('site') && !mapping.siteNumber) mapping.siteNumber = key
        if ((lower.includes('landscape') || lower.includes('habitat') || lower.includes('type')) && !mapping.landscape) mapping.landscape = key
        if ((lower.includes('moisture') || lower.includes('soil_moisture')) && !mapping.soilMoisture) mapping.soilMoisture = key
        if ((lower.includes('temperature') || lower.includes('temp') || lower.includes('soil_temp')) && !mapping.soilTemperature) mapping.soilTemperature = key
      })

      setColumnMapping(mapping)
      showSuccess(`✅ File loaded! Preview: ${data.length} rows detected`)
    } catch (err) {
      setError(err.message)
      showError(`Failed to load file: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!file || preview.length === 0) return

    setLoading(true)
    setError(null)

    try {
      let data = []

      if (file.name.endsWith('.csv')) {
        const text = await file.text()
        const parsed = Papa.parse(text, { header: true })
        data = parsed.data.filter(row => Object.values(row).some(v => v))
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        data = XLSX.utils.sheet_to_json(sheet)
      }

      // Validate that required columns are mapped
      if (!columnMapping.latitude || !columnMapping.longitude) {
        throw new Error('Latitude and longitude columns must be selected')
      }

      // Convert to site entries
      const sites = data.map((row, idx) => {
        const lat = parseFloat(row[columnMapping.latitude])
        const lon = parseFloat(row[columnMapping.longitude])

        // Validate coordinates
        if (!isFinite(lat) || lat < -90 || lat > 90) {
          throw new Error(`Invalid latitude in row ${idx + 1}: ${row[columnMapping.latitude]}`)
        }
        if (!isFinite(lon) || lon < -180 || lon > 180) {
          throw new Error(`Invalid longitude in row ${idx + 1}: ${row[columnMapping.longitude]}`)
        }

        return {
          id: Date.now() + idx,
          siteNumber: row[columnMapping.siteNumber] || idx + 1,
          date: row[columnMapping.date] || new Date().toISOString().split('T')[0],
          latitude: lat,
          longitude: lon,
          accuracy: parseInt(row[columnMapping.accuracy]) || 5,
          collector: 'Imported',
          localTime: '12:00',
          utcOffset: '+00:00',
          landscape: row[columnMapping.landscape] || '',
          soilMoisture: row[columnMapping.soilMoisture] ? parseFloat(row[columnMapping.soilMoisture]) : '',
          soilTemperature: row[columnMapping.soilTemperature] ? parseFloat(row[columnMapping.soilTemperature]) : '',
          shadowExperimentNetting: '0',
          carbonFluxMeasurement: false,
          vegetationShort: {},
          vegetationLong: [],
          soilProfile: [],
          weather: {},
          morphology: {},
          aquaticTerrestrial: 'terrestrial',
          notes: `Imported from ${file.name}`
        }
      })

      if (sites.length === 0) {
        throw new Error('No valid sites with coordinates found')
      }

      // Load existing entries
      const existing = await localforage.getItem('allEntries') || []
      const updated = [...existing, ...sites]

      // Save to localStorage
      await localforage.setItem('allEntries', updated)

      setError(null)
      showSuccess(`✅ Successfully imported ${sites.length} sites! Total: ${updated.length}`)
      setCurrentPage('home')
      // Pass ALL entries (existing + imported) to update parent state
      if (onSitesImported) onSitesImported(updated)
    } catch (err) {
      const errorMsg = err.message
      setError(errorMsg)
      showError(`Import failed: ${errorMsg}`)
    } finally {
      setLoading(false)
    }
  }

  const columnOptions = preview.length > 0 ? Object.keys(preview[0]) : []

  return (
    <div className="page-content">
      <button className="btn-back" onClick={() => setCurrentPage('home')}>← Back to Menu</button>
      <h2>Import Sites from File</h2>

      <div className="section">
        <h3>Supported Formats</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          ✅ CSV (.csv)<br/>
          ✅ Excel (.xlsx, .xls)<br/>
          📌 Required columns: latitude, longitude
        </p>

        <div className="field-group">
          <label>Select File</label>
          {/* Hidden input — triggered programmatically to avoid Android label bug */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              width: '100%', padding: '14px 20px',
              backgroundColor: loading ? 'var(--bg-secondary)' : 'var(--primary-color)',
              color: loading ? 'var(--text-secondary)' : 'white',
              borderRadius: '10px', cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '700', fontSize: '15px', border: 'none'
            }}
          >
            {loading ? '⏳ Loading…' : '📂 Choose CSV / Excel file'}
          </button>
        </div>

        {error && (
          <div style={{
            padding: '12px',
            backgroundColor: 'rgba(211, 47, 47, 0.1)',
            color: '#d32f2f',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '13px'
          }}>
            {error}
          </div>
        )}

        {preview.length > 0 && (
          <>
            <h3>Column Mapping</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Select which columns contain your site data:
            </p>

            {Object.entries(columnMapping).map(([field, value]) => (
              <div key={field} className="field-group" style={{ marginBottom: '12px' }}>
                <label>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                <select
                  value={value}
                  onChange={(e) => setColumnMapping({ ...columnMapping, [field]: e.target.value })}
                >
                  <option value="">{field === 'accuracy' ? '(auto-detect)' : '(skip)'}</option>
                  {columnOptions.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            ))}

            <h3>Preview ({preview.length} rows)</h3>
            <div style={{
              overflowX: 'auto',
              fontSize: '12px',
              marginBottom: '16px'
            }}>
              <table style={{
                borderCollapse: 'collapse',
                width: '100%'
              }}>
                <thead>
                  <tr>
                    {Object.keys(preview[0] || {}).map(key => (
                      <th key={key} style={{
                        border: '1px solid var(--border-color)',
                        padding: '8px',
                        textAlign: 'left',
                        backgroundColor: 'var(--bg-secondary)'
                      }}>
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, idx) => (
                    <tr key={idx}>
                      {Object.values(row).map((val, i) => (
                        <td key={i} style={{
                          border: '1px solid var(--border-color)',
                          padding: '8px'
                        }}>
                          {String(val).substring(0, 30)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={handleImport}
              disabled={loading || !columnMapping.latitude || !columnMapping.longitude}
              style={{
                padding: '12px 24px',
                backgroundColor: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                opacity: (!columnMapping.latitude || !columnMapping.longitude) ? 0.5 : 1
              }}
            >
              {loading ? '⏳ Importing...' : '✅ Import Sites'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
