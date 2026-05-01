import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import localforage from 'localforage'
import { useAsyncStorage } from './hooks/useAsyncStorage'
import { useNotificationContext } from './context/NotificationContext'
import { validateCompleteEntry } from './utils/validators'
import ErrorBoundary from './components/ErrorBoundary'
import PointInfo from './components/PointInfo'
import Weather from './components/Weather'
import VegetationShort from './components/VegetationShort'
import VegetationLong from './components/VegetationLong'
import SoilProfile from './components/SoilProfile'
import Morphology from './components/Morphology'
import Export from './components/Export'
import Home from './pages/Home'
import ManageCategories from './pages/ManageCategories'
import UploadSpecies from './pages/UploadSpecies'
import Settings from './pages/Settings'
import DataManagement from './pages/DataManagement'
import Help from './pages/Help'
import RepeatSites from './pages/RepeatSites'
import Statistics from './pages/Statistics'
import ImportSites from './pages/ImportSites'
import './App.css'

// Calculate current UTC offset
function getCurrentUTCOffset() {
  const now = new Date()
  const offset = -now.getTimezoneOffset()
  const hours = Math.floor(Math.abs(offset) / 60)
  const minutes = Math.abs(offset) % 60
  const sign = offset >= 0 ? '+' : '-'
  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

// Initialize default short vegetation categories
function getDefaultVegetationShort() {
  const categories = [
    'Shrubs', 'Dwarf Shrubs', 'Grass', 'Sedges',
    'Green Mosses', 'Sphagnum Mosses', 'Brown Mosses',
    'Lichens', 'Bare Peat', 'Litter Standing Dead'
  ]
  const result = {}
  categories.forEach(cat => {
    result[cat] = { coverage: 0, height: '', notes: '' }
  })
  return result
}

function App() {
  const [darkMode, setDarkMode] = useState(false)
  const [allEntries, setAllEntries] = useState([])
  const [currentPage, setCurrentPage] = useState('home') // home, diary, categories, species, settings, data, help, metadata, repeat
  // Persistent carbon flux measurement flag
  const [carbonFluxMeasurementDefault, setCarbonFluxMeasurementDefault] = useState(false)

  const { control, watch, setValue, reset } = useForm({
    defaultValues: {
      collector: '',
      siteNumber: 1,
      date: new Date().toISOString().split('T')[0],
      localTime: '',
      utcOffset: getCurrentUTCOffset(),
      latitude: '',
      longitude: '',
      accuracy: '',
      landscape: '',
      soilMoisture: '',
      soilTemperature: '',
      terrestrialAquatic: 'terrestrial',
      shadowExperimentNetting: '0',
      carbonFluxMeasurement: false,
      weather: {},
      vegetationShort: getDefaultVegetationShort(),
      vegetationLong: [],
      soilProfile: [],
      morphology: '',
      notes: ''
    }
  })

  const formData = watch()
  const { showError, showSuccess } = useNotificationContext()

  // Auto-save with debouncing (1000ms delay)
  const [savedEntry, setSavedEntry, saveError] = useAsyncStorage(
    'currentEntry',
    formData,
    1000 // 1 second debounce
  )

  // Update saved entry when formData changes
  useEffect(() => {
    setSavedEntry(formData)
  }, [formData])

  // Show error if auto-save fails
  useEffect(() => {
    if (saveError) {
      showError(`Failed to save current entry: ${saveError.message}`)
    }
  }, [saveError, showError])

  // Load saved data on mount
  useEffect(() => {
    const loadFromStorage = async () => {
      try {
        const entries = await localforage.getItem('allEntries')
        if (entries) {
          setAllEntries(entries)
        }
      } catch (error) {
        console.error('Error loading entries from storage:', error)
        showError('Failed to load saved entries')
      }
    }
    loadFromStorage()
  }, [showError])

  const copyFromPrevious = () => {
    if (allEntries.length > 0) {
      const lastEntry = allEntries[allEntries.length - 1]
      const now = new Date()
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')

      // Preserve carbonFluxMeasurement flag from previous entry
      const carbonFlux = lastEntry.carbonFluxMeasurement || false
      setCarbonFluxMeasurementDefault(carbonFlux)

      reset({
        ...lastEntry,
        siteNumber: (lastEntry.siteNumber || 1) + 1,
        date: new Date().toISOString().split('T')[0],
        localTime: `${hours}:${minutes}`,
        latitude: '',
        longitude: '',
        accuracy: '',
        carbonFluxMeasurement: carbonFlux
      })
    }
  }

  const saveEntry = async () => {
    try {
      // Validate entry using comprehensive validators
      const validation = validateCompleteEntry(formData)

      if (!validation.isValid) {
        // Show first error to user
        showError(validation.errors[0])
        return
      }

      // Show warnings if any
      validation.warnings.forEach(warning => console.warn(`⚠️ ${warning}`))

      const newEntries = [...allEntries, formData]
      await localforage.setItem('allEntries', newEntries)
      setAllEntries(newEntries)

      // Keep carbonFluxMeasurement state persistent for next entry
      const persistedCarbonFlux = formData.carbonFluxMeasurement
      setCarbonFluxMeasurementDefault(persistedCarbonFlux)

      // Reset for next entry
      const nextNumber = (formData.siteNumber || 1) + 1
      reset({
        ...formData,
        siteNumber: nextNumber,
        date: new Date().toISOString().split('T')[0],
        localTime: '',
        latitude: '',
        longitude: '',
        accuracy: '',
        carbonFluxMeasurement: persistedCarbonFlux,
        weather: {},
        vegetationShort: getDefaultVegetationShort(),
        vegetationLong: [],
        soilProfile: [],
        morphology: '',
        notes: ''
      })
      showSuccess(`✅ Entry saved! Ready for site ${nextNumber}`)
    } catch (error) {
      console.error('Error saving entry:', error)
      showError(`Failed to save entry: ${error.message}`)
    }
  }

  return (
    <div className={`app ${darkMode ? 'dark' : 'light'}`}>
      <header className="app-header">
        <h1 style={{ cursor: 'pointer' }} onClick={() => setCurrentPage('home')}>
          Field Campaign Tracker
        </h1>
        <div className="header-controls">
          <button
            className="theme-toggle"
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? 'Light mode' : 'Dark mode'}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
          {currentPage !== 'home' && (
            <span className="entry-count">Entries: {allEntries.length}</span>
          )}
        </div>
      </header>

      <main className="form-container">
        <ErrorBoundary>
          {currentPage === 'home' && (
            <Home setCurrentPage={setCurrentPage} allEntries={allEntries} />
          )}
          {currentPage === 'diary' && (
            <div>
              <div className="diary-top-actions">
                <button className="btn-back" onClick={() => setCurrentPage('home')}>← Back to Menu</button>
                {allEntries.length > 0 && (
                  <button className="btn-copy-previous" onClick={copyFromPrevious}>
                    📋 Copy from Previous
                  </button>
                )}
                <button className="btn-save-entry" onClick={saveEntry}>
                  Save Entry & Next Point
                </button>
              </div>

              {/* Carbon Flux Measurement Toggle */}
              <div className="carbon-flux-toggle">
                <label className="carbon-flux-label">
                  <input
                    type="checkbox"
                    checked={formData.carbonFluxMeasurement || false}
                    onChange={(e) => setValue('carbonFluxMeasurement', e.target.checked)}
                    className="carbon-flux-checkbox"
                  />
                  <span className="carbon-flux-text">🌬️ Carbon flux measurement</span>
                </label>
              </div>

              <div className="sections-grid">
            <PointInfo control={control} watch={watch} setValue={setValue} />
            <Weather control={control} watch={watch} setValue={setValue} />
            <div className="aquatic-selector">
              <label>Environment</label>
              <select
                value={formData.terrestrialAquatic}
                onChange={(e) => setValue('terrestrialAquatic', e.target.value)}
              >
                <option value="terrestrial">Terrestrial</option>
                <option value="aquatic">Aquatic</option>
              </select>
            </div>
            <VegetationShort control={control} watch={watch} setValue={setValue} />
            <VegetationLong control={control} watch={watch} setValue={setValue} />
            <SoilProfile control={control} watch={watch} setValue={setValue} />
            <Morphology control={control} watch={watch} setValue={setValue} />
          </div>

          <div className="form-actions">
              <Export entries={allEntries} />
              </div>
            </div>
          )}
          {currentPage === 'categories' && (
            <ManageCategories setCurrentPage={setCurrentPage} />
          )}
          {currentPage === 'species' && (
            <UploadSpecies setCurrentPage={setCurrentPage} />
          )}
          {currentPage === 'settings' && (
            <Settings setCurrentPage={setCurrentPage} />
          )}
          {currentPage === 'data' && (
            <DataManagement setCurrentPage={setCurrentPage} allEntries={allEntries} />
          )}
          {currentPage === 'help' && (
            <Help setCurrentPage={setCurrentPage} />
          )}
          {currentPage === 'repeat' && (
            <RepeatSites setCurrentPage={setCurrentPage} allEntries={allEntries} />
          )}
          {currentPage === 'statistics' && (
            <Statistics setCurrentPage={setCurrentPage} allEntries={allEntries} />
          )}
          {currentPage === 'import' && (
            <ImportSites setCurrentPage={setCurrentPage} onSitesImported={(sites) => setAllEntries([...allEntries, ...sites])} />
          )}
        </ErrorBoundary>
      </main>
    </div>
  )
}

export default App
