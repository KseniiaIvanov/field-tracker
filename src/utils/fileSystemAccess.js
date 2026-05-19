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
      const request = indexedDB.open('field-diary-storage', 1)
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
      const request = indexedDB.open('field-diary-storage', 1)
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
        if (note.audioData) {
          const timestamp = note.timestamp ? new Date(note.timestamp).toISOString().slice(11, 19) : index
          await saveAudioToDevice(voiceFolder, note, `voice_note_${timestamp}`)
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
    const audioData = note.audioData
    if (!audioData) return

    const base64 = audioData.split(',')[1]
    if (!base64) return

    const fileName = `${baseFileName}.wav`

    // Convert base64 to blob
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: 'audio/wav' })

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
