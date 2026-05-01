import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import localforage from 'localforage'
import { useNotificationContext } from '../context/NotificationContext'

export default function UploadSpecies({ setCurrentPage }) {
  const { showError, showSuccess } = useNotificationContext()
  const [species, setSpecies] = useState([])
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('')

  useEffect(() => {
    loadSpecies()
  }, [])

  const loadSpecies = async () => {
    try {
      const saved = await localforage.getItem('speciesList')
      if (saved && saved.length > 0) {
        setSpecies(saved)
      } else {
        setSpecies([
          { name: 'Example Species 1', category: 'Moss' },
          { name: 'Example Species 2', category: 'Grass' }
        ])
      }
    } catch (error) {
      console.error('Error loading species:', error)
      setSpecies([
        { name: 'Example Species 1', category: 'Moss' },
        { name: 'Example Species 2', category: 'Grass' }
      ])
    }
  }

  const saveSpecies = async (updatedSpecies) => {
    try {
      await localforage.setItem('speciesList', updatedSpecies)
      setSpecies(updatedSpecies)
    } catch (error) {
      console.error('Error saving species:', error)
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const fileName = file.name.toLowerCase()
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
    const isCSV = fileName.endsWith('.csv')

    if (isExcel) {
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const workbook = XLSX.read(event.target.result, { type: 'binary' })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const data = XLSX.utils.sheet_to_json(worksheet)

          if (!data || data.length === 0) {
            throw new Error('No data found in Excel file')
          }

          const species_data = data
            .filter(row => row['Species Name'] || row['species name'] || Object.values(row)[0])
            .map(row => {
              const name = row['Species Name'] || row['species name'] || row['Name'] || row['name'] || Object.values(row)[0]
              const category = row['Category'] || row['category'] || Object.values(row)[1] || 'Unknown'
              return {
                name: String(name).trim() || '',
                category: String(category).trim() || 'Unknown'
              }
            })
            .filter(s => s.name)

          if (species_data.length === 0) {
            throw new Error('No valid species found in Excel file')
          }

          saveSpecies(species_data)
          showSuccess(`✅ Loaded ${species_data.length} species from Excel!`)
        } catch (error) {
          showError(`Failed to parse Excel file: ${error.message}`)
        }
      }
      reader.readAsBinaryString(file)
    } else if (isCSV) {
      Papa.parse(file, {
        complete: (results) => {
          try {
            const data = results.data
              .filter(row => row[0] && row[0].trim())
              .map(row => ({
                name: row[0]?.trim() || '',
                category: row[1]?.trim() || 'Unknown'
              }))

            if (data.length === 0) {
              throw new Error('No valid species found in CSV file')
            }

            saveSpecies(data)
            showSuccess(`✅ Loaded ${data.length} species from CSV!`)
          } catch (error) {
            showError(`Failed to process CSV: ${error.message}`)
          }
        },
        error: (error) => {
          showError(`Error parsing CSV: ${error.message}`)
        }
      })
    } else {
      showError('Please upload a CSV or Excel file (.csv, .xlsx, .xls)')
    }
  }

  const addSpecies = () => {
    if (newName.trim()) {
      const updated = [...species, { name: newName.trim(), category: newCategory || 'Uncategorized' }]
      saveSpecies(updated)
      setNewName('')
      setNewCategory('')
    }
  }

  const removeSpecies = (index) => {
    const updated = species.filter((_, i) => i !== index)
    saveSpecies(updated)
  }

  const downloadTemplate = () => {
    const csv = 'Species Name,Category\nExample Species,Moss\nAnother Species,Grass\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'species-template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="page-content">
      <button className="btn-back" onClick={() => setCurrentPage('home')}>← Back to Menu</button>

      <h2>Vegetation Species List</h2>

      <div className="section">
        <h3>Upload File</h3>
        <p className="info-text">Supports CSV and Excel formats. Columns: Species Name, Category</p>
        <div className="upload-area">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            id="file-upload"
          />
          <label htmlFor="file-upload" className="btn-upload">
            📁 Choose CSV or Excel
          </label>
          <button className="btn-template" onClick={downloadTemplate}>
            📥 Download Template
          </button>
        </div>
      </div>

      <div className="section">
        <h3>Add Species Manually</h3>
        <div className="add-form">
          <input
            type="text"
            placeholder="Species name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            type="text"
            placeholder="Category (optional)"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
          />
          <button className="btn-add" onClick={addSpecies}>
            + Add Species
          </button>
        </div>
      </div>

      <div className="section">
        <h3>Species Library ({species.length})</h3>
        <div className="species-list">
          {species.map((sp, idx) => (
            <div key={idx} className="species-item">
              <div>
                <strong>{sp.name}</strong>
                <span className="category-badge">{sp.category}</span>
              </div>
              <button
                className="btn-delete"
                onClick={() => removeSpecies(idx)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
