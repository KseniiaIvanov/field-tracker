import JSZip from 'jszip'
import { entrySlug } from './entryLabel'
import { saveFile } from './saveFile'
import { hydrateEntry } from './entryMedia'

// Convert base64 to blob
function base64ToBlob(base64, type) {
  const byteCharacters = atob(base64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type })
}

// Extract file extension from base64 data URL
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

// Create organized ZIP with folder structure:
// Field_Diary_YYYY-MM-DD/
// ├── 2026-05-04/
// │   ├── Site_001/
// │   │   ├── site_001.json
// │   │   ├── photo_1.jpg
// │   │   └── voice_note_1.wav
export async function createOrganizedZip(entries) {
  const zip = new JSZip()
  const today = new Date().toISOString().split('T')[0]
  const rootFolderName = `Field_Diary_${today}`

  // Group entries by date
  const entriesByDate = {}
  entries.forEach(entry => {
    const date = entry.date || today
    if (!entriesByDate[date]) {
      entriesByDate[date] = []
    }
    entriesByDate[date].push(entry)
  })

  // Create folder structure
  for (const date of Object.keys(entriesByDate).sort()) {
    const dateEntries = entriesByDate[date]

    for (const storedEntry of dateEntries) {
      // Photos/voice live in the media store — pull them back for this one entry
      // just before writing its files, then move on (keeps peak memory low).
      const entry = await hydrateEntry(storedEntry)
      const slug = entrySlug(entry)
      const siteFolderPath = `${rootFolderName}/${date}/${slug}`

      // Add main entry JSON — WITHOUT the heavy base64 blobs (photos/voice are
      // written as separate files below). Keeping the base64 here would duplicate
      // every image 2–3× and blow past iOS Safari's memory limit on large exports.
      const stripPhotos = (arr) => (Array.isArray(arr) ? arr.map((p) => ({ name: p.name, type: p.type, metadata: p.metadata })) : arr)
      const slimEntry = {
        ...entry,
        entryPhotos: stripPhotos(entry.entryPhotos),
        vegetationShortPhotos: stripPhotos(entry.vegetationShortPhotos),
        vegetationLongPhotos: stripPhotos(entry.vegetationLongPhotos),
        voiceNotes: Array.isArray(entry.voiceNotes)
          ? entry.voiceNotes.map((n) => ({ id: n.id, duration: n.duration, timestamp: n.timestamp }))
          : entry.voiceNotes
      }
      const entryJson = JSON.stringify(slimEntry, null, 2)
      zip.file(
        `${siteFolderPath}/${slug}.json`,
        entryJson
      )

      // Add entry photos if present (with original quality + metadata)
      if (entry.entryPhotos && Array.isArray(entry.entryPhotos)) {
        entry.entryPhotos.forEach((photo, photoIndex) => {
          const dataToSave = photo.originalData || photo.data
          if (dataToSave) {
            const extension = getFileExtensionFromDataUrl(dataToSave)
            const photoName = photo.name || `photo_${photoIndex + 1}${extension}`
            const base64 = dataToSave.split(',')[1]
            const photoBlob = base64ToBlob(base64, 'image/jpeg')
            zip.file(
              `${siteFolderPath}/photos/${photoName}`,
              photoBlob
            )

            // Save metadata if available
            if (photo.metadata) {
              const metadataName = photoName.replace(/\.[^/.]+$/, '') + '_metadata.json'
              zip.file(
                `${siteFolderPath}/photos/${metadataName}`,
                JSON.stringify(photo.metadata, null, 2)
              )
            }
          }
        })
      }

      // Add vegetation photos if present (with original quality + metadata)
      if (entry.vegetationShortPhotos && Array.isArray(entry.vegetationShortPhotos)) {
        entry.vegetationShortPhotos.forEach((photo, photoIndex) => {
          const dataToSave = photo.originalData || photo.data
          if (dataToSave) {
            const extension = getFileExtensionFromDataUrl(dataToSave)
            const photoName = photo.name || `vegetation_short_${photoIndex + 1}${extension}`
            const base64 = dataToSave.split(',')[1]
            const photoBlob = base64ToBlob(base64, 'image/jpeg')
            zip.file(
              `${siteFolderPath}/photos/${photoName}`,
              photoBlob
            )

            if (photo.metadata) {
              const metadataName = photoName.replace(/\.[^/.]+$/, '') + '_metadata.json'
              zip.file(
                `${siteFolderPath}/photos/${metadataName}`,
                JSON.stringify(photo.metadata, null, 2)
              )
            }
          }
        })
      }

      if (entry.vegetationLongPhotos && Array.isArray(entry.vegetationLongPhotos)) {
        entry.vegetationLongPhotos.forEach((photo, photoIndex) => {
          const dataToSave = photo.originalData || photo.data
          if (dataToSave) {
            const extension = getFileExtensionFromDataUrl(dataToSave)
            const photoName = photo.name || `vegetation_long_${photoIndex + 1}${extension}`
            const base64 = dataToSave.split(',')[1]
            const photoBlob = base64ToBlob(base64, 'image/jpeg')
            zip.file(
              `${siteFolderPath}/photos/${photoName}`,
              photoBlob
            )

            if (photo.metadata) {
              const metadataName = photoName.replace(/\.[^/.]+$/, '') + '_metadata.json'
              zip.file(
                `${siteFolderPath}/photos/${metadataName}`,
                JSON.stringify(photo.metadata, null, 2)
              )
            }
          }
        })
      }

      // Add voice notes if present
      if (entry.voiceNotes && Array.isArray(entry.voiceNotes)) {
        entry.voiceNotes.forEach((note, noteIndex) => {
          const audioData = note.data || note.audioData
          if (audioData) {
            const base64 = audioData.split(',')[1]
            if (!base64) return
            const mimeMatch = audioData.match(/data:([^;]+);base64/)
            const mimeType = mimeMatch ? mimeMatch[1] : 'audio/webm'
            const ext = mimeType.includes('wav') ? '.wav'
              : mimeType.includes('ogg') ? '.ogg'
              : mimeType.includes('mp4') || mimeType.includes('m4a') ? '.m4a'
              : '.webm'
            const audioName = `voice_note_${noteIndex + 1}${ext}`
            const audioBlob = base64ToBlob(base64, mimeType)
            zip.file(
              `${siteFolderPath}/voice_notes/${audioName}`,
              audioBlob
            )
          }
        })
      }
    }
  }

  return zip
}

// Download organized ZIP
export async function downloadOrganizedZip(entries) {
  try {
    const today = new Date().toISOString().split('T')[0]
    const zip = await createOrganizedZip(entries)
    const blob = await zip.generateAsync({ type: 'blob' })
    await saveFile(blob, `Field_Diary_${today}.zip`, 'application/zip')
  } catch (error) {
    console.error('Error creating organized ZIP:', error)
    throw error
  }
}

// Export index with metadata
export async function createIndexFile(entries) {
  const today = new Date().toISOString().split('T')[0]
  const stats = {
    exportDate: today,
    exportTime: new Date().toLocaleTimeString(),
    totalSites: entries.length,
    dateRange: {
      earliest: entries.length > 0 ? entries.reduce((min, e) => e.date < min.date ? e : min).date : null,
      latest: entries.length > 0 ? entries.reduce((max, e) => e.date > max.date ? e : max).date : null
    },
    sites: entries.map(e => ({
      siteNumber: e.siteNumber,
      date: e.date,
      collector: e.collector,
      hasPhotos: (e.entryPhotos?.length || 0) + (e.vegetationShortPhotos?.length || 0) + (e.vegetationLongPhotos?.length || 0) > 0,
      hasVoiceNotes: (e.voiceNotes?.length || 0) > 0
    }))
  }
  return JSON.stringify(stats, null, 2)
}
