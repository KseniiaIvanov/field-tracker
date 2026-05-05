import piexif from 'piexifjs'

// Extract EXIF metadata from image file
export async function extractExifData(file) {
  const metadata = {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    uploadDate: new Date().toISOString(),
    exif: null
  }

  try {
    if (file.type.startsWith('image/')) {
      // Try to extract EXIF data
      const arrayBuffer = await file.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      const hexString = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')

      try {
        const exifData = piexif.load(hexString)

        // Extract useful EXIF fields
        const exifInfo = {}

        // GPS coordinates if available
        if (exifData['GPS'] && exifData['GPS'][2] && exifData['GPS'][4]) {
          const lat = exifData['GPS'][2]
          const lon = exifData['GPS'][4]

          const dmsToDD = (dms) => {
            return dms[0][0]/dms[0][1] + dms[1][0]/(dms[1][1]*60) + dms[2][0]/(dms[2][1]*3600)
          }

          try {
            exifInfo.gpsLatitude = dmsToDD(lat)
            exifInfo.gpsLongitude = dmsToDD(lon)
            if (exifData['GPS'][1]) exifInfo.gpsLatitudeRef = exifData['GPS'][1]
            if (exifData['GPS'][3]) exifInfo.gpsLongitudeRef = exifData['GPS'][3]
          } catch (e) {
            console.debug('GPS parsing error:', e)
          }
        }

        // Camera/device info
        if (exifData['0th']) {
          const ifd0 = exifData['0th']
          if (ifd0[271]) exifInfo.make = piexif.load(ifd0[271].toString('utf-8')).replace(/\0/g, '') // Camera make
          if (ifd0[272]) exifInfo.model = ifd0[272].toString('utf-8').replace(/\0/g, '') // Camera model
          if (ifd0[306]) exifInfo.datetime = ifd0[306].toString('utf-8').replace(/\0/g, '') // Date/time
        }

        // Image dimensions
        if (exifData['Exif']) {
          const exifIfd = exifData['Exif']
          if (exifIfd[36864]) exifInfo.exifVersion = exifIfd[36864].toString('utf-8')
          if (exifIfd[36867]) exifInfo.dateTimeOriginal = exifIfd[36867].toString('utf-8').replace(/\0/g, '')
        }

        if (Object.keys(exifInfo).length > 0) {
          metadata.exif = exifInfo
        }
      } catch (exifError) {
        console.debug('EXIF extraction not possible for this file:', exifError)
      }
    }
  } catch (error) {
    console.debug('Error extracting metadata:', error)
  }

  return metadata
}

// Process photo for storage - keep original quality for export
export async function processPhoto(file) {
  const metadata = await extractExifData(file)

  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.onloadend = () => {
      const photo = {
        id: Date.now(),
        name: file.name,
        originalData: reader.result, // Full quality original
        previewData: reader.result,  // Will be used for display
        metadata: metadata
      }
      resolve(photo)
    }

    reader.readAsDataURL(file)
  })
}

// Get photo for display (can be thumbnail in future)
export function getPhotoForDisplay(photo) {
  return photo.previewData || photo.originalData
}

// Get photo metadata for export
export function getPhotoMetadata(photo) {
  return {
    fileName: photo.metadata.fileName,
    fileSize: photo.metadata.fileSize,
    fileType: photo.metadata.fileType,
    uploadDate: photo.metadata.uploadDate,
    exif: photo.metadata.exif
  }
}

// Extract base64 from data URL
export function getBase64FromDataUrl(dataUrl) {
  if (!dataUrl) return null
  const parts = dataUrl.split(',')
  return parts.length === 2 ? parts[1] : dataUrl
}
