import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import localforage from 'localforage'
import { useNotificationContext } from './context/NotificationContext'
import { validateCompleteEntry } from './utils/validators'
import { entryLabel, entrySlug } from './utils/entryLabel'
import { processPhoto } from './utils/photoMetadata'
import { isFileSystemAccessAvailable, requestRootDirectory, getRootDirectory, setRootDirectory, saveSiteToDevice, restoreRootDirectory } from './utils/fileSystemAccess'
import ErrorBoundary from './components/ErrorBoundary'
import QuickEntry from './components/QuickEntry'
import PointInfo from './components/PointInfo'
import Weather from './components/Weather'
import VegetationShort from './components/VegetationShort'
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
    result[cat] = { coverage: 0, height: '' }
  })
  return result
}

function App() {
  const [allEntries, setAllEntries] = useState([])
  const [currentPage, setCurrentPage] = useState('home') // home, diary, categories, species, settings, data, help, metadata, repeat
  const [currentStep, setCurrentStep] = useState(1) // Wizard step (1-7)
  const [, setCarbonFluxMeasurementDefault] = useState(false)
  const [quickMode, setQuickMode] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [savedLabel, setSavedLabel] = useState('')
  // When set, the diary form is editing an existing entry (by index) rather than
  // creating a new one — saving updates that entry in place instead of appending.
  const [editingIndex, setEditingIndex] = useState(null)
  const [deviceStoragePath, setDeviceStoragePath] = useState(null)
  const [, setStorageReady] = useState(false)
  const [gpsAveraging, setGpsAveraging] = useState(null) // { startTime, readings: [], status, progress }
  const entryStartTimeRef = useRef(Date.now())
  // Suppress draft autosave briefly after a save so a pending timer can't re-write
  // the just-saved entry back into the draft (which would look like unsaved work).
  const suppressDraftRef = useRef(0)
  // PWA install prompt (Android/Chrome no longer shows an automatic banner —
  // we capture the event and surface our own "Install" button instead)
  const [installPrompt, setInstallPrompt] = useState(null)

  const WIZARD_STEPS = [
    { num: 1, name: 'Site Information', component: 'PointInfo' },
    { num: 2, name: 'Weather, Soil & Morphology', component: 'Conditions' },
    { num: 3, name: 'Vegetation', component: 'VegetationShort' },
    { num: 4, name: 'Review & Save', component: 'ReviewSave' }
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
      area: '',
      collar: '',
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
      activeLayerDepth: '',
      alDepth1: '',
      alDepth2: '',
      alDepth3: '',
      standingWater: false,
      standingWaterDepth: '',
      soilMoistureType: 'moist',
      terrestrialAquatic: 'terrestrial',
      shadowExperimentNetting: '0',
      carbonFluxMeasurement: false,
      weather: {},
      vegetationShort: getDefaultVegetationShort(),
      vegetationShortPhotos: [],
      vegetationShortNotes: '',
      vegetationLong: [],
      vegetationLongPhotos: [],
      vegetationLongNotes: '',
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

        // Restore an unsaved in-progress entry, including photos and the wizard
        // step. iOS frequently reloads PWAs (after the camera or on memory
        // pressure) — this brings you back exactly where you were, with the photo
        // intact, instead of a partial draft you'd have to redo and re-save.
        localStorage.removeItem('field-diary-draft') // drop the old photo-less draft format
        const draft = await localforage.getItem('field-diary-draft-v2')
        const f = draft && draft.form
        // Landscape/area carry over from the previous save, so they alone don't
        // count as "unsaved work" — only restore when there's real in-progress data.
        const hasRealWork = f && (f.latitude || f.longitude || f.notes || f.collar ||
          f.soilTemperature || f.activeLayerDepth ||
          (f.entryPhotos && f.entryPhotos.length > 0) ||
          (f.weather && Object.keys(f.weather).length > 0))
        if (hasRealWork) {
          reset(f)
          if (draft.step) setCurrentStep(draft.step)
          if (draft.editingIndex !== undefined && draft.editingIndex !== null) setEditingIndex(draft.editingIndex)
          setCurrentPage('diary')
          showSuccess(`Recovered your unsaved entry: ${entryLabel(f)}`)
        } else if (draft) {
          await localforage.removeItem('field-diary-draft-v2')
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
          // Try to restore handle from IndexedDB
          const handle = await restoreRootDirectory()
          if (handle) {
            setDeviceStoragePath(`📁 ${handle.name}`)
            setRootDirectory(handle)
            console.log('✅ Storage folder restored from previous session')
          } else {
            const stored = localStorage.getItem('field-diary-storage-path')
            if (stored) {
              setDeviceStoragePath(stored)
            }
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

  // Capture the browser's install prompt so we can offer our own Install button.
  // Modern Chrome/Android suppresses the automatic mini-infobar, so without this
  // the app would never appear installable to the user.
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault() // stop Chrome from auto-handling; we drive it from our button
      setInstallPrompt(e)
    }
    const handleInstalled = () => setInstallPrompt(null)
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const triggerInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    try {
      await installPrompt.userChoice
    } catch {
      // user dismissed — keep the prompt so they can try again later
    }
    setInstallPrompt(null)
  }

  // Mark the start of a new entry whenever the diary form is opened
  useEffect(() => {
    if (currentPage === 'diary') {
      entryStartTimeRef.current = Date.now()
    }
  }, [currentPage])

  // Being on Home means we're not editing anything. editEntry() jumps straight to
  // the diary (never through Home), so this only clears a stale edit link.
  useEffect(() => {
    if (currentPage === 'home') setEditingIndex(null)
  }, [currentPage])

  // Load an existing entry into the diary form for editing (from Data Management)
  const editEntry = (index) => {
    const entry = allEntries[index]
    if (!entry) return
    setEditingIndex(index)
    reset(entry)
    setCurrentStep(1)
    setCurrentPage('diary')
  }

  const deleteEntry = async (index) => {
    const entry = allEntries[index]
    if (!entry) return
    if (!window.confirm(`Delete ${entryLabel(entry)}? This cannot be undone.`)) return
    const newEntries = allEntries.filter((_, i) => i !== index)
    await localforage.setItem('allEntries', newEntries)
    setAllEntries(newEntries)
    showSuccess(`Deleted ${entryLabel(entry)}`)
  }

  // Monitor GPS averaging in background and auto-finalize after 120 seconds
  useEffect(() => {
    if (!gpsAveraging) return

    const interval = setInterval(() => {
      const elapsed = Date.now() - gpsAveraging.startTime
      const progress = Math.min(100, Math.round((elapsed / 60000) * 100))

      setGpsAveraging(prev => ({
        ...prev,
        progress,
        status: `📍 GPS averaging... ${progress}% (${Math.round(elapsed / 1000)}s)`
      }))

      // Auto-finalize after 60 seconds
      if (elapsed >= 60000 && gpsAveraging.readings.length > 0) {
        const readings = gpsAveraging.readings
        const avgLat = readings.reduce((sum, r) => sum + r.lat, 0) / readings.length
        const avgLon = readings.reduce((sum, r) => sum + r.lon, 0) / readings.length
        const minAccuracy = Math.round(Math.min(...readings.map(r => r.accuracy)))

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

  // Autosave the full in-progress entry (photos included) plus the wizard step to
  // IndexedDB a couple seconds after the last change. IndexedDB has room for the
  // photos (localStorage did not), so an unexpected iOS reload can restore the
  // entry completely instead of losing the photo. Cleared on a successful save.
  useEffect(() => {
    if (currentPage !== 'diary') return
    const hasData = formData.latitude || formData.longitude || formData.notes ||
      formData.landscape || formData.collar ||
      (formData.entryPhotos && formData.entryPhotos.length > 0)
    if (!hasData) return
    const timer = setTimeout(() => {
      if (Date.now() < suppressDraftRef.current) return
      localforage.setItem('field-diary-draft-v2', { form: formData, step: currentStep, editingIndex })
        .catch((e) => console.warn('Draft save failed:', e))
    }, 2000)
    return () => clearTimeout(timer)
  }, [formData, currentStep, currentPage, editingIndex])

  const copyFromPrevious = () => {
    if (allEntries.length > 0) {
      setEditingIndex(null) // copy starts a new entry, not an edit
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
        collar: '',
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
      setDeviceStoragePath(`📁 ${dirHandle.name}`)
      localStorage.setItem('field-diary-storage-path', 'selected')
      showSuccess('✅ Storage folder selected. Sites will now save directly to your device.')
    } catch (error) {
      if (error.message !== 'User cancelled folder selection') {
        showError(`Failed to select folder: ${error.message}`)
      }
    }
  }

  const downloadEntryWithPhotos = async (entry) => {
    const filename = `${entrySlug(entry)}_${entry.date}.json`
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

      const isEditing = editingIndex !== null

      // Time spent on this entry (only meaningful for a new entry; keep the
      // original value when editing an existing one).
      const entryDurationSeconds = Math.round((Date.now() - entryStartTimeRef.current) / 1000)
      const entryToSave = isEditing ? { ...formData } : { ...formData, entryDurationSeconds }
      // Capture the label now, before reset() clears the collar for the next point
      const savedEntryLabel = entryLabel(entryToSave)

      const newEntries = isEditing
        ? allEntries.map((e, i) => (i === editingIndex ? entryToSave : e))
        : [...allEntries, entryToSave]
      await localforage.setItem('allEntries', newEntries)
      setAllEntries(newEntries)

      // Editing: update in place, then return to the list. Skip the new-entry
      // reset/increment and the per-point backup download.
      if (isEditing) {
        setEditingIndex(null)
        suppressDraftRef.current = Date.now() + 3000
        localStorage.removeItem('field-diary-draft')
        await localforage.removeItem('field-diary-draft-v2')
        setSavedLabel(savedEntryLabel)
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 2000)
        showSuccess(`✅ ${savedEntryLabel} updated`)
        setCurrentStep(1)
        setCurrentPage('data')
        return
      }

      // Save to device storage if available
      try {
        const rootDir = getRootDirectory()
        if (rootDir) {
          await saveSiteToDevice(entryToSave, rootDir)
          console.log(`✅ Site saved to device storage`)
        }
      } catch (deviceError) {
        console.warn('Device storage save failed, will fallback to download:', deviceError)
      }

      // Auto-download entry as individual file (backup)
      downloadEntryWithPhotos(entryToSave)

      // Keep carbonFluxMeasurement state persistent for next entry
      const persistedCarbonFlux = formData.carbonFluxMeasurement
      setCarbonFluxMeasurementDefault(persistedCarbonFlux)

      // Start the clock for the next entry
      entryStartTimeRef.current = Date.now()

      // Reset for next entry
      const nextNumber = (formData.siteNumber || 1) + 1
      reset({
        ...formData,
        siteNumber: nextNumber,
        collar: '', // area carries over via spread; collar clears for the next chamber
        date: new Date().toISOString().split('T')[0],
        localTime: '',
        latitude: '',
        longitude: '',
        accuracy: '',
        disturbance: '',
        organicMatterType: '',
        activeLayerDepth: '',
        alDepth1: '',
        alDepth2: '',
        alDepth3: '',
        voiceNotes: [],
        standingWater: false,
        standingWaterDepth: '',
        carbonFluxMeasurement: persistedCarbonFlux,
        weather: {},
        vegetationShort: getDefaultVegetationShort(),
        vegetationShortPhotos: [],
        vegetationShortNotes: '',
        vegetationLong: [],
        vegetationLongPhotos: [],
        vegetationLongNotes: '',
        soilProfile: [],
        morphology: '',
        notes: '',
        entryPhotos: []
      })
      // Show large visual confirmation
      setSavedLabel(savedEntryLabel)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)

      showSuccess(`✅ ${savedEntryLabel} saved! Ready for the next point`)
      localStorage.removeItem('field-diary-draft')
      suppressDraftRef.current = Date.now() + 3000
      await localforage.removeItem('field-diary-draft-v2')
      setCurrentStep(1)

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
      {installPrompt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          padding: 'calc(env(safe-area-inset-top, 0px) + 8px) 12px 8px',
          backgroundColor: '#1976d2',
          color: 'white',
          fontSize: '13px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
          <span>📲 Install Field Tracker for offline use</span>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            <button
              onClick={triggerInstall}
              style={{ padding: '6px 14px', backgroundColor: 'white', color: '#1976d2', border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
            >
              Install
            </button>
            <button
              onClick={() => setInstallPrompt(null)}
              style={{ padding: '6px 10px', backgroundColor: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
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
                  padding: '24px 40px',
                  borderRadius: '16px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                  textAlign: 'center',
                  zIndex: 1000,
                  animation: 'fadeInOut 2s ease-in-out'
                }}>
                  <div style={{ fontSize: '36px', marginBottom: '8px' }}>✅</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {savedLabel} saved!
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
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
                  {/* TOP: Home + Quick/Copy buttons (smaller, secondary) */}
                  <div style={{ paddingTop: 'calc(env(safe-area-inset-top, 20px) + 56px)', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <button className="btn-back" onClick={() => { setCurrentPage('home'); setCurrentStep(1); }} style={{ padding: '6px 6px', fontSize: '11px', minHeight: '32px', whiteSpace: 'nowrap', fontWeight: '600' }}>← Home</button>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {currentStep === 1 && (
                        <button
                          onClick={() => { setEditingIndex(null); setQuickMode(true) }}
                          style={{ padding: '11px 18px', fontSize: '15px', minHeight: '42px', whiteSpace: 'nowrap', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}
                        >Quick</button>
                      )}
                      {allEntries.length > 0 && (
                        <button className="btn-copy-previous" onClick={copyFromPrevious} style={{ padding: '6px 12px', fontSize: '12px', minHeight: '32px', whiteSpace: 'nowrap', fontWeight: '600', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer' }}>
                          📋 Copy
                        </button>
                      )}
                    </div>
                  </div>

              {editingIndex !== null && (
                <div style={{ marginBottom: '10px', padding: '8px 12px', backgroundColor: 'rgba(255,152,0,0.12)', border: '1px solid #ff9800', borderRadius: '6px', fontSize: '12px', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <span>✏️ Editing an existing entry — saving updates it in place.</span>
                  <button onClick={() => { setEditingIndex(null); setCurrentPage('data') }} style={{ padding: '4px 10px', backgroundColor: 'transparent', border: '1px solid #ff9800', color: 'var(--text-primary)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}>Cancel</button>
                </div>
              )}

              {/* STEP ROW: ← arrow | Step X/Y · Name | → arrow */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <button
                  onClick={prevStep}
                  disabled={currentStep === 1}
                  style={{
                    width: '44px', height: '44px', flexShrink: 0,
                    backgroundColor: currentStep === 1 ? 'var(--bg-secondary)' : 'var(--primary-color)',
                    color: currentStep === 1 ? 'var(--text-tertiary)' : 'white',
                    border: 'none', borderRadius: '8px',
                    cursor: currentStep === 1 ? 'not-allowed' : 'pointer',
                    fontWeight: '700', fontSize: '18px'
                  }}
                >←</button>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <h2 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: '700' }}>Step {currentStep}/{WIZARD_STEPS.length}</h2>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.2' }}>{WIZARD_STEPS[currentStep - 1].name}</p>
                </div>
                <button
                  onClick={nextStep}
                  disabled={currentStep === WIZARD_STEPS.length}
                  style={{
                    width: '44px', height: '44px', flexShrink: 0,
                    backgroundColor: currentStep === WIZARD_STEPS.length ? 'var(--bg-secondary)' : 'var(--primary-color)',
                    color: currentStep === WIZARD_STEPS.length ? 'var(--text-tertiary)' : 'white',
                    border: 'none', borderRadius: '8px',
                    cursor: currentStep === WIZARD_STEPS.length ? 'not-allowed' : 'pointer',
                    fontWeight: '700', fontSize: '18px'
                  }}
                >→</button>
              </div>

              {/* PROGRESS BAR */}
              <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--bg-secondary)', borderRadius: '2px', marginBottom: '20px', overflow: 'hidden' }}>
                <div style={{ width: `${(currentStep / WIZARD_STEPS.length) * 100}%`, height: '100%', backgroundColor: 'var(--success-color)', transition: 'width 0.3s ease' }} />
              </div>


              {/* WIZARD STEPS */}
              <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                {currentStep === 1 && <PointInfo control={control} watch={watch} setValue={setValue} previousEntry={allEntries.length > 0 ? allEntries[allEntries.length - 1] : null} gpsAveraging={gpsAveraging} setGpsAveraging={setGpsAveraging} />}
                {currentStep === 2 && (
                  <>
                    {/* MOST-USED quick panel: the few fields filled at every point */}
                    <div className="section">
                      <div className="section-header"><h2>Most used</h2></div>
                      <div className="section-content" style={{ paddingTop: '12px' }}>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                          <div className="field-group">
                            <label style={{ fontSize: '12px' }}>Cloud Cover: {formData.weather?.cloudCover ?? 0}%</label>
                            <input type="range" min="0" max="100" value={formData.weather?.cloudCover ?? 0}
                              onChange={(e) => setValue('weather', { ...(formData.weather || {}), cloudCover: parseInt(e.target.value) })} />
                          </div>
                          <div className="field-group">
                            <label style={{ fontSize: '12px' }}>Precipitation</label>
                            <select value={formData.weather?.precipitation || 'none'}
                              onChange={(e) => setValue('weather', { ...(formData.weather || {}), precipitation: e.target.value })}>
                              <option value="none">None</option>
                              <option value="drizzle">Drizzle</option>
                              <option value="light">Light</option>
                              <option value="moderate">Moderate</option>
                              <option value="heavy">Heavy</option>
                              <option value="snow">Snow</option>
                              <option value="sleet">Sleet</option>
                            </select>
                          </div>
                        </div>

                        <div className="field-group" style={{ marginBottom: '12px' }}>
                          <label style={{ fontSize: '12px' }}>Wind</label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                            {['Calm', 'Light', 'Strong'].map((w) => {
                              const active = formData.weather?.wind === w
                              return (
                                <button key={w} type="button"
                                  onClick={() => setValue('weather', { ...(formData.weather || {}), wind: w })}
                                  style={{ padding: '10px 6px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px', backgroundColor: active ? 'var(--primary-color)' : 'var(--bg-secondary)', color: active ? 'white' : 'var(--text-primary)' }}>
                                  {w}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        <div className="field-group" style={{ marginBottom: '12px' }}>
                          <label style={{ fontSize: '12px' }}>AL Depth cm (3 readings){formData.activeLayerDepth !== '' && formData.activeLayerDepth !== undefined ? ` — ∅ ${formData.activeLayerDepth} cm` : ''}</label>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {[1, 2, 3].map((i) => (
                              <input key={i} type="number" min="0" step="1" placeholder={`#${i}`}
                                value={formData[`alDepth${i}`] ?? ''}
                                onChange={(e) => {
                                  const v = e.target.value === '' ? '' : parseFloat(e.target.value)
                                  setValue(`alDepth${i}`, v)
                                  const vals = [
                                    i === 1 ? v : formData.alDepth1,
                                    i === 2 ? v : formData.alDepth2,
                                    i === 3 ? v : formData.alDepth3
                                  ].filter(x => x !== '' && x !== null && x !== undefined && !isNaN(x))
                                  setValue('activeLayerDepth', vals.length ? Math.round(vals.reduce((a, b) => a + Number(b), 0) / vals.length) : '')
                                }}
                                style={{ flex: 1, textAlign: 'center', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 8px' }} />
                            ))}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                          <div className="field-group">
                            <label style={{ fontSize: '12px' }}>Moisture Type</label>
                            <select value={formData.soilMoistureType || 'moist'} onChange={(e) => setValue('soilMoistureType', e.target.value)}>
                              <option value="dry">Dry</option>
                              <option value="moist">Moist</option>
                              <option value="wet">Wet</option>
                              <option value="saturated">Saturated</option>
                            </select>
                          </div>
                          <div className="field-group">
                            <label style={{ fontSize: '12px' }}>Standing Water</label>
                            <select value={formData.standingWater ? 'yes' : 'no'} onChange={(e) => setValue('standingWater', e.target.value === 'yes')}>
                              <option value="no">No</option>
                              <option value="yes">Yes</option>
                            </select>
                          </div>
                        </div>

                        <div className="field-group">
                          <label style={{ fontSize: '12px' }}>Topography</label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                            {[{ v: 'slope', l: 'Slope' }, { v: 'depression', l: 'Depression' }, { v: 'elevated', l: 'Elevated' }].map((t) => {
                              const active = formData.morphology === t.v
                              return (
                                <button key={t.v} type="button" onClick={() => setValue('morphology', t.v)}
                                  style={{ padding: '10px 6px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px', backgroundColor: active ? 'var(--primary-color)' : 'var(--bg-secondary)', color: active ? 'white' : 'var(--text-primary)' }}>
                                  {t.l}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* EVERYTHING ELSE — full sections below */}
                    <p style={{ fontSize: '11px', color: '#aaa', margin: '16px 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>All other details</p>
                    <Weather control={control} watch={watch} setValue={setValue} previousEntry={allEntries.length > 0 ? allEntries[allEntries.length - 1] : null} />
                    <SoilProfile control={control} watch={watch} setValue={setValue} />
                    <Morphology control={control} watch={watch} setValue={setValue} />
                  </>
                )}
                {currentStep === 3 && (
                  <div>
                    <VegetationShort control={control} watch={watch} setValue={setValue} />
                    <div className="section" style={{ marginTop: '16px' }}>
                      <div className="section-content" style={{ paddingTop: '12px' }}>
                        <div className="field-group">
                          <label>Environment</label>
                          <select value={formData.terrestrialAquatic} onChange={(e) => setValue('terrestrialAquatic', e.target.value)}>
                            <option value="terrestrial">Terrestrial</option>
                            <option value="aquatic">Aquatic</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {currentStep === 4 && (
                  <div className="section">
                    <div className="section-header"><h2>Review & Save</h2></div>
                    <div className="section-content" style={{ paddingTop: '10px' }}>

                      {/* Top row: Camera | Gallery | Save */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 6px', backgroundColor: 'var(--primary-color)', color: 'white', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontWeight: '600', fontSize: '14px', gap: '4px' }}>
                          📸 Camera
                          <input type="file" accept="image/*" capture="environment" onChange={handleEntryPhotoUpload} style={{ display: 'none' }} />
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 6px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontWeight: '600', fontSize: '14px', gap: '4px' }}>
                          📷 Gallery
                          <input type="file" multiple accept="image/*" onChange={handleEntryPhotoUpload} style={{ display: 'none' }} />
                        </label>
                        <button
                          onClick={saveEntry}
                          style={{ padding: '14px 6px', background: 'linear-gradient(135deg, var(--success-color) 0%, #1b4332 100%)', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontWeight: '700', fontSize: '14px' }}
                        >
                          💾 Save Entry
                        </button>
                      </div>

                      {/* Photo thumbnails */}
                      {formData.entryPhotos && formData.entryPhotos.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px', marginBottom: '10px' }}>
                          {formData.entryPhotos.map((photo) => (
                            <div key={photo.id} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
                              <img src={photo.previewData || photo.originalData || photo.data} alt={photo.name} style={{ width: '100%', height: '80px', objectFit: 'cover' }} />
                              <button onClick={() => removeEntryPhoto(photo.id)} style={{ position: 'absolute', top: '2px', right: '2px', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '12px', padding: 0, lineHeight: '20px', textAlign: 'center' }}>✕</button>
                            </div>
                          ))}
                        </div>
                      )}

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
            <DataManagement setCurrentPage={setCurrentPage} allEntries={allEntries} onEditEntry={editEntry} onDeleteEntry={deleteEntry} />
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
