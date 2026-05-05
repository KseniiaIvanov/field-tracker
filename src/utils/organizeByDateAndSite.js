import JSZip from 'jszip'

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
  Object.keys(entriesByDate).sort().forEach(date => {
    const dateEntries = entriesByDate[date]

    dateEntries.forEach((entry, index) => {
      const siteNumber = String(entry.siteNumber).padStart(3, '0')
      const siteFolderPath = `${rootFolderName}/${date}/Site_${siteNumber}`

      // Add main entry JSON
      const entryJson = JSON.stringify(entry, null, 2)
      zip.file(
        `${siteFolderPath}/site_${siteNumber}.json`,
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
          if (note.audioData) {
            const timestamp = note.timestamp ? new Date(note.timestamp).toISOString().slice(11, 19) : noteIndex
            const audioName = `voice_note_${timestamp}.wav`
            const base64 = note.audioData.split(',')[1]
            const audioBlob = base64ToBlob(base64, 'audio/wav')
            zip.file(
              `${siteFolderPath}/voice_notes/${audioName}`,
              audioBlob
            )
          }
        })
      }
    })
  })

  return zip
}

// Download organized ZIP
export async function downloadOrganizedZip(entries) {
  try {
    const today = new Date().toISOString().split('T')[0]
    const zip = await createOrganizedZip(entries)
    const blob = await zip.generateAsync({ type: 'blob' })

    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Field_Diary_${today}.zip`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
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
