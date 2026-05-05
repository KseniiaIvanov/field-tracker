import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import localforage from 'localforage'
import { useAsyncStorage } from './hooks/useAsyncStorage'
import { useNotificationContext } from './context/NotificationContext'
import { validateCompleteEntry } from './utils/validators'
import { processPhoto } from './utils/photoMetadata'
import { isFileSystemAccessAvailable, requestRootDirectory, getRootDirectory, setRootDirectory, saveSiteToDevice } from './utils/fileSystemAccess'
import ErrorBoundary from './components/ErrorBoundary'
import QuickEntry from './components/QuickEntry'
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
  const [allEntries, setAllEntries] = useState([])
  const [currentPage, setCurrentPage] = useState('home') // home, diary, categories, species, settings, data, help, metadata, repeat
  const [currentStep, setCurrentStep] = useState(1) // Wizard step (1-7)
  const [carbonFluxMeasurementDefault, setCarbonFluxMeasurementDefault] = useState(false)
  const [quickMode, setQuickMode] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [deviceStoragePath, setDeviceStoragePath] = useState(null)
  const [storageReady, setStorageReady] = useState(false)
  const [gpsAveraging, setGpsAveraging] = useState(null) // { startTime, readings: [], status, progress }

  const WIZARD_STEPS = [
    { num: 1, name: 'Site Information', component: 'PointInfo' },
    { num: 2, name: 'Weather', component: 'Weather' },
    { num: 3, name: 'Vegetation (Short)', component: 'VegetationShort' },
    { num: 4, name: 'Vegetation (Long)', component: 'VegetationLong' },
    { num: 5, name: 'Soil Profile', component: 'SoilProfile' },
    { num: 6, name: 'Morphology', component: 'Morphology' },
    { num: 7, name: 'Review & Save', component: 'ReviewSave' }
  ]

  const nextStep = () => {
    if (currentStep < WIZARD_STEPS.length) {
      setCurrentStep(currentStep + 1)
      window.scrollTo(0, 0)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      window.scrollTo(0, 0)
    }
  }

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
      disturbance: '',
      organicMatterType: '',
      voiceNotes: [],
      soilMoisture: '',
      soilTemperature: '',
      standingWater: false,
      standingWaterDepth: '',
      terrestrialAquatic: 'terrestrial',
      shadowExperimentNetting: '0',
      carbonFluxMeasurement: false,
      weather: {},
      vegetationShort: getDefaultVegetationShort(),
      vegetationShortPhotos: [],
      vegetationLong: [],
      vegetationLongPhotos: [],
      soilProfile: [],
      morphology: '',
      notes: '',
      entryPhotos: []
    }
  })

  const formData = watch()
  const { showError, showSuccess } = useNotificationContext()

  // No auto-save - only save on button click to preserve battery
  // This is safer anyway - prevents accidental data loss from network issues

  // Load saved data on mount and request persistent storage
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

    // Request persistent storage for data protection
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist()
        .then(persisted => {
          if (persisted) {
            console.log('✅ Storage persistent - data protected from browser deletion')
          } else {
            console.warn('⚠️ Storage temporary - data may be cleared if device storage is low')
          }
        })
        .catch(error => {
          console.warn('Persistent storage not available:', error)
        })
    }

    // Check and restore file system access if available
    if (isFileSystemAccessAvailable()) {
      const restoreStorageFolder = async () => {
        try {
          const stored = localStorage.getItem('field-diary-storage-path')
          if (stored) {
            setDeviceStoragePath(stored)
          }
          setStorageReady(true)
        } catch (error) {
          console.warn('Could not restore storage folder:', error)
          setStorageReady(true)
        }
      }
      restoreStorageFolder()
    } else {
      console.log('File System Access API not available - will use auto-download fallback')
      setStorageReady(true)
    }
  }, [showError])

  // Monitor GPS averaging in background and auto-finalize after 120 seconds
  useEffect(() => {
    if (!gpsAveraging) return

    const interval = setInterval(() => {
      const elapsed = Date.now() - gpsAveraging.startTime
      const progress = Math.min(100, Math.round((elapsed / 120000) * 100))

      setGpsAveraging(prev => ({
        ...prev,
        progress,
        status: `📍 GPS averaging... ${progress}% (${Math.round(elapsed / 1000)}s)`
      }))

      // Auto-finalize after 120 seconds
      if (elapsed >= 120000 && gpsAveraging.readings.length > 0) {
        const readings = gpsAveraging.readings
        const avgLat = readings.reduce((sum, r) => sum + r.lat, 0) / readings.length
        const avgLon = readings.reduce((sum, r) => sum + r.lon, 0) / readings.length
        const minAccuracy = Math.round(Math.min(...readings.map(r => r.accuracy)))
        const avgAccuracy = Math.round(readings.reduce((sum, r) => sum + r.accuracy, 0) / readings.length)

        setValue('latitude', avgLat.toFixed(6))
        setValue('longitude', avgLon.toFixed(6))
        setValue('accuracy', minAccuracy)

        setGpsAveraging(null)
        showSuccess(`✅ GPS locked! ${readings.length} readings | Accuracy: ${minAccuracy}m`)
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [gpsAveraging, setValue, showSuccess])

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

  const addEntryPhoto = async (file) => {
    try {
      const photoWithMetadata = await processPhoto(file)
      const currentPhotos = formData.entryPhotos || []
      setValue('entryPhotos', [...currentPhotos, photoWithMetadata])
    } catch (error) {
      console.error('Error processing photo:', error)
      showError('Failed to process photo')
    }
  }

  const removeEntryPhoto = (id) => {
    const currentPhotos = formData.entryPhotos || []
    setValue('entryPhotos', currentPhotos.filter(p => p.id !== id))
  }

  const handleEntryPhotoUpload = (e) => {
    const files = Array.from(e.target.files || [])
    files.forEach(file => {
      addEntryPhoto(file).catch(error => {
        console.error('Photo upload error:', error)
      })
    })
    e.target.value = ''
  }

  const selectStorageFolder = async () => {
    try {
      const dirHandle = await requestRootDirectory()
      setRootDirectory(dirHandle)
      setDeviceStoragePath(`📁 Storage folder selected`)
      localStorage.setItem('field-diary-storage-path', 'selected')
      showSuccess('✅ Storage folder selected. Sites will now save directly to your device.')
    } catch (error) {
      if (error.message !== 'User cancelled folder selection') {
        showError(`Failed to select folder: ${error.message}`)
      }
    }
  }

  const downloadEntryAsFile = (entry) => {
    const filename = `entry_site${entry.siteNumber}_${entry.date}.json`
    const json = JSON.stringify(entry, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  const downloadEntryWithPhotos = async (entry) => {
    const siteNumber = String(entry.siteNumber).padStart(3, '0')
    const filename = `Site_${siteNumber}_${entry.date}.json`
    const json = JSON.stringify(entry, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
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

      // Save to device storage if available
      try {
        const rootDir = getRootDirectory()
        if (rootDir) {
          await saveSiteToDevice(formData, rootDir)
          console.log(`✅ Site saved to device storage`)
        }
      } catch (deviceError) {
        console.warn('Device storage save failed, will fallback to download:', deviceError)
      }

      // Auto-download entry as individual file (backup)
      downloadEntryWithPhotos(formData)

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
        disturbance: '',
        organicMatterType: '',
        voiceNotes: [],
        standingWater: false,
        standingWaterDepth: '',
        carbonFluxMeasurement: persistedCarbonFlux,
        weather: {},
        vegetationShort: getDefaultVegetationShort(),
        vegetationShortPhotos: [],
        vegetationLong: [],
        vegetationLongPhotos: [],
        soilProfile: [],
        morphology: '',
        notes: '',
        entryPhotos: []
      })
      // Show large visual confirmation
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)

      showSuccess(`✅ Site ${formData.siteNumber} saved! Ready for site ${nextNumber}`)
      setCurrentStep(1) // Reset wizard to step 1

      // If in quick mode, show success and reset
      if (quickMode) {
        setTimeout(() => {
          setQuickMode(false)
        }, 2500)
      }
    } catch (error) {
      console.error('Error saving entry:', error)
      showError(`Failed to save entry: ${error.message}`)
    }
  }

  return (
    <div className="app light">
      <main className="form-container" style={{ paddingBottom: currentPage === 'diary' ? '120px' : '0' }}>
        <ErrorBoundary>
          {currentPage === 'home' && (
            <Home setCurrentPage={setCurrentPage} allEntries={allEntries} onSelectStorageFolder={selectStorageFolder} deviceStoragePath={deviceStoragePath} storageAvailable={isFileSystemAccessAvailable()} />
          )}
          {currentPage === 'diary' && (
            <div>
              {/* SAVE SUCCESS CONFIRMATION */}
              {saveSuccess && (
                <div style={{
                  position: 'fixed',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: 'white',
                  padding: '40px 60px',
                  borderRadius: '16px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                  textAlign: 'center',
                  zIndex: 1000,
                  animation: 'fadeInOut 2s ease-in-out'
                }}>
                  <div style={{ fontSize: '64px', marginBottom: '12px' }}>✅</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Site {formData.siteNumber} saved!
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                    Ready for next point
                  </div>
                </div>
              )}

              {quickMode ? (
                <QuickEntry
                  control={control}
                  watch={watch}
                  setValue={setValue}
                  onSave={saveEntry}
                  onBack={() => setQuickMode(false)}
                  allEntries={allEntries}
                />
              ) : (
                <>
                  {/* WIZARD HEADER */}
                  <div style={{ paddingTop: '70px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <button className="btn-back" onClick={() => { setCurrentPage('home'); setCurrentStep(1); }} style={{ padding: '10px 16px', fontSize: '13px', minHeight: '36px', whiteSpace: 'nowrap', fontWeight: '600' }}>← Back</button>
                    <div style={{ textAlign: 'center', flex: 1, minWidth: '150px' }}>
                      <h2 style={{ margin: '0 0 2px 0', fontSize: '16px', fontWeight: '700' }}>Step {currentStep}/{WIZARD_STEPS.length}</h2>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.2' }}>{WIZARD_STEPS[currentStep - 1].name}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {currentStep === 1 && (
                        <button
                          onClick={() => setQuickMode(true)}
                          style={{
                            padding: '10px 20px',
                            fontSize: '13px',
                            minHeight: '36px',
                            whiteSpace: 'nowrap',
                            backgroundColor: 'var(--primary-color)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '600'
                          }}
                          title="Switch to quick entry mode"
                        >
                          ⚡ Quick
                        </button>
                      )}
                      {allEntries.length > 0 && (
                        <button className="btn-copy-previous" onClick={copyFromPrevious} style={{ padding: '10px 16px', fontSize: '13px', minHeight: '36px', whiteSpace: 'nowrap', fontWeight: '600' }}>
                          📋 Copy
                        </button>
                      )}
                    </div>
                  </div>

              {/* PROGRESS BAR */}
              <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '3px', marginBottom: '24px', overflow: 'hidden' }}>
                <div style={{ width: `${(currentStep / WIZARD_STEPS.length) * 100}%`, height: '100%', backgroundColor: 'var(--success-color)', transition: 'width 0.3s ease' }} />
              </div>

              {/* TOP NAVIGATION BUTTONS */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', justifyContent: 'center' }}>
                <button
                  onClick={prevStep}
                  disabled={currentStep === 1}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: currentStep === 1 ? 'var(--bg-secondary)' : 'var(--primary-color)',
                    color: currentStep === 1 ? 'var(--text-tertiary)' : 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    cursor: currentStep === 1 ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    transition: 'all var(--transition-normal)'
                  }}
                >
                  ← Back
                </button>
                {currentStep < WIZARD_STEPS.length && (
                  <button
                    onClick={nextStep}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: 'var(--primary-color)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-lg)',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px',
                      transition: 'all var(--transition-normal)'
                    }}
                  >
                    Next →
                  </button>
                )}
              </div>

              {/* CARBON FLUX TOGGLE */}
              {currentStep === 1 && (
                <div className="carbon-flux-toggle" style={{ marginBottom: '24px' }}>
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
              )}

              {/* WIZARD STEPS */}
              <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                {currentStep === 1 && <PointInfo control={control} watch={watch} setValue={setValue} previousEntry={allEntries.length > 0 ? allEntries[allEntries.length - 1] : null} gpsAveraging={gpsAveraging} setGpsAveraging={setGpsAveraging} />}
                {currentStep === 2 && <Weather control={control} watch={watch} setValue={setValue} previousEntry={allEntries.length > 0 ? allEntries[allEntries.length - 1] : null} />}
                {currentStep === 3 && (
                  <div className="section">
                    <button className="section-header" style={{ width: '100%' }}><h2>Vegetation (Short)</h2></button>
                    <div className="section-content">
                      <div className="field-group">
                        <label>Environment</label>
                        <select value={formData.terrestrialAquatic} onChange={(e) => setValue('terrestrialAquatic', e.target.value)}>
                          <option value="terrestrial">Terrestrial</option>
                          <option value="aquatic">Aquatic</option>
                        </select>
                      </div>
                    </div>
                    <VegetationShort control={control} watch={watch} setValue={setValue} />
                  </div>
                )}
                {currentStep === 4 && <VegetationLong control={control} watch={watch} setValue={setValue} />}
                {currentStep === 5 && <SoilProfile control={control} watch={watch} setValue={setValue} />}
                {currentStep === 6 && <Morphology control={control} watch={watch} setValue={setValue} />}
                {currentStep === 7 && (
                  <div className="section">
                    <div className="section-header"><h2>Review & Save</h2></div>
                    <div className="section-content">
                      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                        ✓ All data ready. Click "Save Entry" to complete this site.
                      </p>

                      <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--border-color)' }}>
                        <h3 style={{ marginBottom: '12px' }}>Entry Photos</h3>
                        <div style={{ marginBottom: '12px' }}>
                          <label style={{ display: 'inline-block', padding: '10px 16px', backgroundColor: 'var(--primary-color)', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
                            📷 Add Photos
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              onChange={handleEntryPhotoUpload}
                              style={{ display: 'none' }}
                            />
                          </label>
                        </div>

                        {formData.entryPhotos && formData.entryPhotos.length > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '12px' }}>
                            {formData.entryPhotos.map((photo) => (
                              <div key={photo.id} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--bg-secondary)' }}>
                                <img src={photo.previewData || photo.originalData || photo.data} alt={photo.name} style={{ width: '100%', height: '100px', objectFit: 'cover' }} title={photo.metadata ? `${photo.metadata.fileSize} bytes • ${photo.metadata.fileName}` : photo.name} />
                                <button
                                  onClick={() => removeEntryPhoto(photo.id)}
                                  style={{ position: 'absolute', top: '4px', right: '4px', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <Export entries={allEntries} />
                    </div>
                  </div>
                )}
              </div>

              {/* WIZARD NAVIGATION */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '32px', justifyContent: 'center' }}>
                <button
                  onClick={prevStep}
                  disabled={currentStep === 1}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: currentStep === 1 ? 'var(--bg-secondary)' : 'var(--primary-color)',
                    color: currentStep === 1 ? 'var(--text-tertiary)' : 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    cursor: currentStep === 1 ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    transition: 'all var(--transition-normal)'
                  }}
                >
                  ← Back
                </button>
                {currentStep < WIZARD_STEPS.length && (
                  <button
                    onClick={nextStep}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: 'var(--primary-color)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-lg)',
                      cursor: 'pointer',
                      fontWeight: '600',
                      transition: 'all var(--transition-normal)'
                    }}
                  >
                    Next →
                  </button>
                )}
                {currentStep === WIZARD_STEPS.length && (
                  <button
                    onClick={saveEntry}
                    style={{
                      padding: '12px 32px',
                      background: 'linear-gradient(135deg, var(--success-color) 0%, #1b4332 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-lg)',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '16px',
                      transition: 'all var(--transition-normal)'
                    }}
                  >
                    💾 Save Entry
                  </button>
                )}
              </div>
                </>
              )}
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
