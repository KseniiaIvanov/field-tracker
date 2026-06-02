// File System Access API wrapper for saving directly to device storage

let rootDirectoryHandle = null

// Check if File System Access API is available
export function isFileSystemAccessAvailable() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

// Try to restore handle from IndexedDB
export async function restoreRootDirectory() {
  if (!isFileSystemAccessAvailable()) return null

  try {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('field-diary-storage', 2)
      request.onupgradeneeded = (e) => {
        const database = e.target.result
        if (!database.objectStoreNames.contains('directory-handle')) {
          database.createObjectStore('directory-handle')
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    return new Promise((resolve) => {
      const transaction = db.transaction('directory-handle', 'readonly')
      const request = transaction.objectStore('directory-handle').get('root')
      request.onsuccess = async () => {
        if (request.result?.handle) {
          try {
            // Verify permission still exists
            const permission = await request.result.handle.queryPermission({ mode: 'readwrite' })
            if (permission === 'granted') {
              rootDirectoryHandle = request.result.handle
              resolve(rootDirectoryHandle)
            } else {
              resolve(null)
            }
          } catch {
            resolve(null)
          }
        } else {
          resolve(null)
        }
      }
    })
  } catch {
    return null
  }
}

// Save handle to IndexedDB for persistence
async function saveHandleToDb(handle) {
  try {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('field-diary-storage', 2)
      request.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains('directory-handle')) {
          db.createObjectStore('directory-handle')
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    return new Promise((resolve) => {
      const transaction = db.transaction('directory-handle', 'readwrite')
      transaction.objectStore('directory-handle').put({ handle }, 'root')
      transaction.oncomplete = () => resolve(true)
    })
  } catch (error) {
    console.warn('Could not save handle to IndexedDB:', error)
  }
}

// Request access to a directory (user selects folder)
export async function requestRootDirectory() {
  try {
    rootDirectoryHandle = await window.showDirectoryPicker({
      mode: 'readwrite',
      id: 'field-diary-storage',
      startIn: 'documents'
    })
    // Save handle for persistence
    await saveHandleToDb(rootDirectoryHandle)
    return rootDirectoryHandle
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('User cancelled folder selection')
    }
    throw error
  }
}

// Get currently selected root directory
export function getRootDirectory() {
  return rootDirectoryHandle
}

// Set root directory (for persistence across sessions)
export function setRootDirectory(handle) {
  rootDirectoryHandle = handle
}

// Format entry as human-readable text
function formatEntryAsText(entry) {
  const lines = []
  const siteNumber = String(entry.siteNumber).padStart(3, '0')
  const sep = '-'.repeat(40)

  lines.push(`FIELD DIARY — SITE ${siteNumber}`)
  lines.push(sep)

  // Basic info
  lines.push(`Date:        ${entry.date || '—'}`)
  lines.push(`Time:        ${entry.localTime || '—'} (UTC ${entry.utcOffset || ''})`)
  lines.push(`Collector:   ${entry.collector || '—'}`)
  lines.push('')

  // Location
  lines.push('LOCATION')
  lines.push(`  Latitude:  ${entry.latitude || '—'}`)
  lines.push(`  Longitude: ${entry.longitude || '—'}`)
  if (entry.accuracy) lines.push(`  Accuracy:  ${entry.accuracy} m`)
  lines.push('')

  // Site info
  lines.push('SITE')
  lines.push(`  Landscape:   ${entry.landscape || '—'}`)
  if (entry.disturbance) lines.push(`  Disturbance: ${entry.disturbance}`)
  if (entry.organicMatterType) lines.push(`  Organic matter: ${entry.organicMatterType}`)
  if (entry.terrestrialAquatic) lines.push(`  Environment: ${entry.terrestrialAquatic}`)
  lines.push('')

  // Weather
  if (entry.weather && Object.keys(entry.weather).length > 0) {
    lines.push('WEATHER')
    const w = entry.weather
    if (w.airTemperature !== undefined) lines.push(`  Air temp:  ${w.airTemperature} °C`)
    if (w.cloudCover !== undefined) lines.push(`  Cloud:     ${w.cloudCover}`)
    if (w.windSpeed !== undefined) lines.push(`  Wind:      ${w.windSpeed} m/s`)
    if (w.precipitation !== undefined) lines.push(`  Precip:    ${w.precipitation}`)
    lines.push('')
  }

  // Soil
  const hasSoil = entry.soilMoisture || entry.soilTemperature || entry.activeLayerDepth
  if (hasSoil) {
    lines.push('SOIL')
    if (entry.soilTemperature) lines.push(`  Soil temp:    ${entry.soilTemperature} °C`)
    if (entry.soilMoisture) lines.push(`  Soil moisture: ${entry.soilMoisture}`)
    if (entry.soilMoistureType) lines.push(`  Moisture type: ${entry.soilMoistureType}`)
    if (entry.activeLayerDepth) lines.push(`  Active layer: ${entry.activeLayerDepth} cm`)
    const alDepths = [entry.alDepth1, entry.alDepth2, entry.alDepth3].filter(Boolean)
    if (alDepths.length) lines.push(`  AL depths:    ${alDepths.join(', ')} cm`)
    if (entry.standingWater) lines.push(`  Standing water: yes${entry.standingWaterDepth ? `, ${entry.standingWaterDepth} cm` : ''}`)
    lines.push('')
  }

  // Vegetation short
  if (entry.vegetationShort && Object.keys(entry.vegetationShort).length > 0) {
    lines.push('VEGETATION (SHORT)')
    for (const [cat, val] of Object.entries(entry.vegetationShort)) {
      const cov = val?.coverage ?? 0
      if (cov > 0 || val?.height) {
        const covLabel = cov === 0 ? 'Absent' : cov === 1 ? 'Present' : 'Dominant'
        const ht = val?.height ? `, ${val.height} cm` : ''
        lines.push(`  ${cat}: ${covLabel}${ht}`)
      }
    }
    if (entry.vegetationShortNotes) lines.push(`  Notes: ${entry.vegetationShortNotes}`)
    lines.push('')
  }

  // Morphology
  if (entry.morphology) {
    lines.push('MORPHOLOGY')
    lines.push(`  Topography: ${entry.morphology}`)
    if (entry.waterFeatures) lines.push(`  Water: ${entry.waterFeatures}`)
    if (entry.morphologyNotes) lines.push(`  Notes: ${entry.morphologyNotes}`)
    lines.push('')
  }

  // Carbon flux
  if (entry.carbonFluxMeasurement) {
    lines.push('Carbon flux measurement: YES')
    lines.push('')
  }

  // Notes
  if (entry.notes) {
    lines.push('NOTES')
    lines.push(entry.notes)
    lines.push('')
  }

  // Summary counts
  const photoCount = (entry.entryPhotos?.length || 0) +
    (entry.vegetationShortPhotos?.length || 0) +
    (entry.vegetationLongPhotos?.length || 0)
  const voiceCount = entry.voiceNotes?.length || 0
  if (photoCount || voiceCount) {
    lines.push(sep)
    if (photoCount) lines.push(`Photos: ${photoCount}`)
    if (voiceCount) lines.push(`Voice notes: ${voiceCount}`)
  }

  lines.push(sep)
  lines.push(`Saved: ${new Date().toISOString()}`)

  return lines.join('\n')
}

// Save site entry to device storage
export async function saveSiteToDevice(entry, rootHandle) {
  if (!rootHandle) {
    throw new Error('No directory selected. Please select a storage folder first.')
  }

  const date = entry.date || new Date().toISOString().split('T')[0]
  const siteNumber = String(entry.siteNumber).padStart(3, '0')

  try {
    // Create date folder
    const dateFolder = await rootHandle.getDirectoryHandle(date, { create: true })

    // Create site folder
    const siteFolder = await dateFolder.getDirectoryHandle(`Site_${siteNumber}`, { create: true })

    // Save main JSON file
    const jsonFileName = `site_${siteNumber}.json`
    const jsonFile = await siteFolder.getFileHandle(jsonFileName, { create: true })
    const jsonWriter = await jsonFile.createWritable()
    const jsonContent = JSON.stringify(entry, null, 2)
    await jsonWriter.write(jsonContent)
    await jsonWriter.close()

    // Save human-readable text file
    const txtFileName = `site_${siteNumber}.txt`
    const txtFile = await siteFolder.getFileHandle(txtFileName, { create: true })
    const txtWriter = await txtFile.createWritable()
    await txtWriter.write(formatEntryAsText(entry))
    await txtWriter.close()

    // Create photos folder if needed
    let photosFolder = null
    if (entry.entryPhotos?.length || entry.vegetationShortPhotos?.length || entry.vegetationLongPhotos?.length) {
      photosFolder = await siteFolder.getDirectoryHandle('photos', { create: true })
    }

    // Save entry photos
    if (entry.entryPhotos && Array.isArray(entry.entryPhotos)) {
      for (const [index, photo] of entry.entryPhotos.entries()) {
        await savePhotoToDevice(photosFolder, photo, `photo_${index + 1}`)
      }
    }

    // Save vegetation short photos
    if (entry.vegetationShortPhotos && Array.isArray(entry.vegetationShortPhotos)) {
      for (const [index, photo] of entry.vegetationShortPhotos.entries()) {
        await savePhotoToDevice(photosFolder, photo, `vegetation_short_${index + 1}`)
      }
    }

    // Save vegetation long photos
    if (entry.vegetationLongPhotos && Array.isArray(entry.vegetationLongPhotos)) {
      for (const [index, photo] of entry.vegetationLongPhotos.entries()) {
        await savePhotoToDevice(photosFolder, photo, `vegetation_long_${index + 1}`)
      }
    }

    // Save voice notes
    if (entry.voiceNotes && entry.voiceNotes.length > 0) {
      const voiceFolder = await siteFolder.getDirectoryHandle('voice_notes', { create: true })
      for (const [index, note] of entry.voiceNotes.entries()) {
        if (note.data) {
          await saveAudioToDevice(voiceFolder, note, `voice_note_${index + 1}`)
        }
      }
    }

    return {
      success: true,
      path: `${date}/Site_${siteNumber}`,
      message: `✅ Site ${siteNumber} saved to: ${date}/Site_${siteNumber}/`
    }
  } catch (error) {
    console.error('Error saving to device:', error)
    throw new Error(`Failed to save site to device: ${error.message}`)
  }
}

// Helper: save photo to device
async function savePhotoToDevice(photosFolder, photo, baseFileName) {
  if (!photosFolder) return

  try {
    const dataUrl = photo.originalData || photo.data
    if (!dataUrl) return

    // Extract extension and base64
    const extension = getFileExtensionFromDataUrl(dataUrl)
    const base64 = dataUrl.split(',')[1]
    if (!base64) return

    const fileName = `${baseFileName}${extension}`

    // Convert base64 to blob
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: 'image/jpeg' })

    // Write photo file
    const photoFile = await photosFolder.getFileHandle(fileName, { create: true })
    const photoWriter = await photoFile.createWritable()
    await photoWriter.write(blob)
    await photoWriter.close()

    // Save metadata if available
    if (photo.metadata) {
      const metadataFileName = `${baseFileName}_metadata.json`
      const metadataFile = await photosFolder.getFileHandle(metadataFileName, { create: true })
      const metadataWriter = await metadataFile.createWritable()
      await metadataWriter.write(JSON.stringify(photo.metadata, null, 2))
      await metadataWriter.close()
    }
  } catch (error) {
    console.error(`Error saving photo ${baseFileName}:`, error)
  }
}

// Helper: save audio to device
async function saveAudioToDevice(voiceFolder, note, baseFileName) {
  try {
    const audioData = note.data
    if (!audioData) return

    const base64 = audioData.split(',')[1]
    if (!base64) return

    // Detect actual MIME type from data URL (browser records as webm, ogg, or m4a)
    const mimeMatch = audioData.match(/data:([^;]+);base64/)
    const mimeType = mimeMatch ? mimeMatch[1] : 'audio/webm'
    const ext = mimeType.includes('wav') ? '.wav'
      : mimeType.includes('ogg') ? '.ogg'
      : mimeType.includes('mp4') || mimeType.includes('m4a') ? '.m4a'
      : '.webm'
    const fileName = `${baseFileName}${ext}`

    // Convert base64 to blob
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: mimeType })

    // Write audio file
    const audioFile = await voiceFolder.getFileHandle(fileName, { create: true })
    const audioWriter = await audioFile.createWritable()
    await audioWriter.write(blob)
    await audioWriter.close()
  } catch (error) {
    console.error(`Error saving audio ${baseFileName}:`, error)
  }
}

// Helper: get file extension from data URL
function getFileExtensionFromDataUrl(dataUrl) {
  const match = dataUrl.match(/data:([^;]+);base64/)
  if (match) {
    const mimeType = match[1]
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return '.jpg'
    if (mimeType.includes('png')) return '.png'
    if (mimeType.includes('webp')) return '.webp'
    if (mimeType.includes('audio')) return '.wav'
  }
  return '.bin'
}

// Request permission to read/write from previously selected directory
export async function verifyDirectoryPermission(handle) {
  try {
    const permission = await handle.queryPermission({ mode: 'readwrite' })
    if (permission === 'granted') {
      return true
    }
    if (permission === 'prompt') {
      const newPermission = await handle.requestPermission({ mode: 'readwrite' })
      return newPermission === 'granted'
    }
    return false
  } catch (error) {
    console.error('Error verifying directory permission:', error)
    return false
  }
}
