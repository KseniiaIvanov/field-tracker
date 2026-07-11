/**
 * Data Validation Utilities
 * Comprehensive validators for coordinates, CRS, timestamps, file types, CSV schema
 */

import logger from './logger'

const MODULE = 'validators'

/**
 * Coordinate validators
 */
export const coordinateValidators = {
  /**
   * Validate latitude value
   * @param {number} lat - Latitude value
   * @returns {object} { isValid, error }
   */
  latitude(lat) {
    if (lat === null || lat === undefined || lat === '') {
      return { isValid: false, error: 'Latitude is required' }
    }

    const num = parseFloat(lat)
    if (!isFinite(num)) {
      return { isValid: false, error: `Invalid latitude: "${lat}" is not a number` }
    }

    if (num < -90 || num > 90) {
      return { isValid: false, error: `Latitude must be between -90 and 90 (got ${num})` }
    }

    return { isValid: true }
  },

  /**
   * Validate longitude value
   * @param {number} lon - Longitude value
   * @returns {object} { isValid, error }
   */
  longitude(lon) {
    if (lon === null || lon === undefined || lon === '') {
      return { isValid: false, error: 'Longitude is required' }
    }

    const num = parseFloat(lon)
    if (!isFinite(num)) {
      return { isValid: false, error: `Invalid longitude: "${lon}" is not a number` }
    }

    if (num < -180 || num > 180) {
      return { isValid: false, error: `Longitude must be between -180 and 180 (got ${num})` }
    }

    return { isValid: true }
  },

  /**
   * Validate coordinate pair
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {object} { isValid, error }
   */
  pair(lat, lon) {
    const latCheck = this.latitude(lat)
    if (!latCheck.isValid) return latCheck

    const lonCheck = this.longitude(lon)
    if (!lonCheck.isValid) return lonCheck

    return { isValid: true }
  },

  /**
   * Validate coordinate bounds
   * @param {object} bounds - { minLat, maxLat, minLon, maxLon }
   * @returns {object} { isValid, error }
   */
  bounds(bounds) {
    const { minLat, maxLat, minLon, maxLon } = bounds

    const latCheck = this.latitude(minLat)
    if (!latCheck.isValid) return { ...latCheck, field: 'minLat' }

    const latCheck2 = this.latitude(maxLat)
    if (!latCheck2.isValid) return { ...latCheck2, field: 'maxLat' }

    const lonCheck = this.longitude(minLon)
    if (!lonCheck.isValid) return { ...lonCheck, field: 'minLon' }

    const lonCheck2 = this.longitude(maxLon)
    if (!lonCheck2.isValid) return { ...lonCheck2, field: 'maxLon' }

    if (minLat >= maxLat) {
      return { isValid: false, error: `Invalid latitude range: minLat (${minLat}) must be < maxLat (${maxLat})` }
    }

    if (minLon >= maxLon) {
      return { isValid: false, error: `Invalid longitude range: minLon (${minLon}) must be < maxLon (${maxLon})` }
    }

    return { isValid: true }
  }
}

/**
 * CRS (Coordinate Reference System) validators
 */
export const crsValidators = {
  /**
   * Validate EPSG code format
   * @param {string} epsg - EPSG code (e.g., "EPSG:4326")
   * @returns {object} { isValid, error, code }
   */
  epsg(epsg) {
    if (!epsg || typeof epsg !== 'string') {
      return { isValid: false, error: 'EPSG code must be a string' }
    }

    const match = epsg.match(/^EPSG:(\d{4,5})$/)
    if (!match) {
      return { isValid: false, error: `Invalid EPSG format: "${epsg}" (expected EPSG:XXXX)` }
    }

    return { isValid: true, code: parseInt(match[1]) }
  },

  /**
   * Check if CRS is a UTM projection
   * @param {string} epsg - EPSG code
   * @returns {boolean}
   */
  isUTM(epsg) {
    const check = this.epsg(epsg)
    if (!check.isValid) return false

    const code = check.code
    // UTM zones: 32601-32660 (North), 32701-32760 (South)
    return (code >= 32601 && code <= 32660) || (code >= 32701 && code <= 32760)
  },

  /**
   * Check if CRS is geographic (lat/lon)
   * @param {string} epsg - EPSG code
   * @returns {boolean}
   */
  isGeographic(epsg) {
    const check = this.epsg(epsg)
    if (!check.isValid) return false

    const code = check.code
    // Common geographic CRS codes: 4326 (WGS84), 4269 (NAD83), 4267 (NAD27)
    return [4326, 4269, 4267, 4258].includes(code)
  },

  /**
   * Check if two CRS codes are compatible
   * @param {string} crs1 - First EPSG code
   * @param {string} crs2 - Second EPSG code
   * @returns {object} { compatible, note }
   */
  areCompatible(crs1, crs2) {
    const check1 = this.epsg(crs1)
    const check2 = this.epsg(crs2)

    if (!check1.isValid || !check2.isValid) {
      return { compatible: false, note: 'Invalid CRS code' }
    }

    if (crs1 === crs2) {
      return { compatible: true, note: 'Same CRS' }
    }

    // If one is UTM and other is geographic, they need transformation
    const isUTM1 = this.isUTM(crs1)
    const isUTM2 = this.isUTM(crs2)
    const isGeo1 = this.isGeographic(crs1)
    const isGeo2 = this.isGeographic(crs2)

    if ((isUTM1 && isGeo2) || (isGeo1 && isUTM2)) {
      return { compatible: true, note: 'Requires coordinate transformation' }
    }

    if ((isUTM1 && isUTM2) || (isGeo1 && isGeo2)) {
      return { compatible: true, note: 'May require transformation' }
    }

    return { compatible: false, note: 'Incompatible coordinate systems' }
  }
}

/**
 * Timestamp validators
 */
export const timestampValidators = {
  /**
   * Validate ISO 8601 date format (YYYY-MM-DD)
   * @param {string} date - Date string
   * @returns {object} { isValid, error, date }
   */
  isoDate(date) {
    if (!date || typeof date !== 'string') {
      return { isValid: false, error: 'Date must be a string' }
    }

    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!match) {
      return { isValid: false, error: `Invalid date format: "${date}" (expected YYYY-MM-DD)` }
    }

    const [, , month, day] = match.map(Number)

    if (month < 1 || month > 12) {
      return { isValid: false, error: `Invalid month: ${month}` }
    }

    if (day < 1 || day > 31) {
      return { isValid: false, error: `Invalid day: ${day}` }
    }

    // More thorough day validation
    const d = new Date(`${date}T00:00:00Z`)
    if (isNaN(d.getTime())) {
      return { isValid: false, error: `Invalid date: ${date}` }
    }

    return { isValid: true, date: d }
  },

  /**
   * Validate ISO 8601 datetime format (YYYY-MM-DDTHH:MM:SS)
   * @param {string} datetime - Datetime string
   * @returns {object} { isValid, error, date }
   */
  isoDatetime(datetime) {
    if (!datetime || typeof datetime !== 'string') {
      return { isValid: false, error: 'Datetime must be a string' }
    }

    // Accept standard ISO format with optional timezone
    const match = datetime.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/)
    if (!match) {
      return { isValid: false, error: `Invalid datetime format: "${datetime}" (expected YYYY-MM-DDTHH:MM:SS)` }
    }

    const d = new Date(datetime)
    if (isNaN(d.getTime())) {
      return { isValid: false, error: `Invalid datetime: ${datetime}` }
    }

    return { isValid: true, date: d }
  },

  /**
   * Validate time format (HH:MM or HH:MM:SS)
   * @param {string} time - Time string
   * @returns {object} { isValid, error }
   */
  time(time) {
    if (!time || typeof time !== 'string') {
      return { isValid: false, error: 'Time must be a string' }
    }

    const match = time.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/)
    if (!match) {
      return { isValid: false, error: `Invalid time format: "${time}" (expected HH:MM or HH:MM:SS)` }
    }

    const [, hours, minutes, seconds] = match.map((v, i) => i === 0 ? parseInt(v) : parseInt(v || 0))

    if (hours < 0 || hours > 23) {
      return { isValid: false, error: `Invalid hours: ${hours} (must be 0-23)` }
    }

    if (minutes < 0 || minutes > 59) {
      return { isValid: false, error: `Invalid minutes: ${minutes} (must be 0-59)` }
    }

    if (seconds < 0 || seconds > 59) {
      return { isValid: false, error: `Invalid seconds: ${seconds} (must be 0-59)` }
    }

    return { isValid: true }
  }
}

/**
 * File validators
 */
export const fileValidators = {
  /**
   * Validate file type
   * @param {File} file - File object
   * @param {array} allowedTypes - Array of allowed MIME types or extensions
   * @returns {object} { isValid, error }
   */
  type(file, allowedTypes = []) {
    if (!file) {
      return { isValid: false, error: 'No file provided' }
    }

    if (allowedTypes.length === 0) {
      return { isValid: true } // No restrictions
    }

    const fileName = file.name.toLowerCase()
    const mimeType = file.type.toLowerCase()

    // Check MIME type
    if (allowedTypes.some(t => mimeType.includes(t))) {
      return { isValid: true }
    }

    // Check file extension
    const ext = fileName.split('.').pop()
    if (allowedTypes.some(t => t.startsWith('.') ? t === `.${ext}` : false)) {
      return { isValid: true }
    }

    return {
      isValid: false,
      error: `File type not allowed. Type: ${mimeType}, Expected: ${allowedTypes.join(', ')}`
    }
  },

  /**
   * Validate file size
   * @param {File} file - File object
   * @param {number} maxSizeMB - Maximum size in MB
   * @returns {object} { isValid, error, sizeMB }
   */
  size(file, maxSizeMB) {
    if (!file) {
      return { isValid: false, error: 'No file provided' }
    }

    const sizeMB = file.size / (1024 * 1024)

    if (sizeMB > maxSizeMB) {
      return {
        isValid: false,
        error: `File too large: ${sizeMB.toFixed(1)}MB (max ${maxSizeMB}MB)`,
        sizeMB
      }
    }

    return { isValid: true, sizeMB }
  },

  /**
   * Validate GeoTIFF file
   * @param {File} file - File object
   * @returns {object} { isValid, error }
   */
  geotiff(file) {
    const typeCheck = this.type(file, ['.tif', '.tiff', 'image/tiff'])
    if (!typeCheck.isValid) return typeCheck

    const sizeCheck = this.size(file, 500)
    if (!sizeCheck.isValid) return sizeCheck

    return { isValid: true }
  },

  /**
   * Validate Shapefile ZIP
   * @param {File} file - File object
   * @returns {object} { isValid, error }
   */
  shapefile(file) {
    const typeCheck = this.type(file, ['.zip', 'application/zip'])
    if (!typeCheck.isValid) return typeCheck

    const sizeCheck = this.size(file, 100)
    if (!sizeCheck.isValid) return sizeCheck

    return { isValid: true }
  },

  /**
   * Validate CSV file
   * @param {File} file - File object
   * @returns {object} { isValid, error }
   */
  csv(file) {
    const typeCheck = this.type(file, ['.csv', 'text/csv', 'application/csv'])
    if (!typeCheck.isValid) return typeCheck

    const sizeCheck = this.size(file, 50)
    if (!sizeCheck.isValid) return sizeCheck

    return { isValid: true }
  }
}

/**
 * Data validators
 */
export const dataValidators = {
  /**
   * Validate site entry
   * @param {object} entry - Site entry object
   * @returns {object} { isValid, errors }
   */
  siteEntry(entry) {
    const errors = []

    if (!entry) {
      return { isValid: false, errors: ['Entry is required'] }
    }

    // Validate coordinates
    const coordCheck = coordinateValidators.pair(entry.latitude, entry.longitude)
    if (!coordCheck.isValid) {
      errors.push(`Coordinates: ${coordCheck.error}`)
    }

    // Validate date
    if (entry.date) {
      const dateCheck = timestampValidators.isoDate(entry.date)
      if (!dateCheck.isValid) {
        errors.push(`Date: ${dateCheck.error}`)
      }
    }

    // Validate time if provided
    if (entry.localTime) {
      const timeCheck = timestampValidators.time(entry.localTime)
      if (!timeCheck.isValid) {
        errors.push(`Time: ${timeCheck.error}`)
      }
    }

    // Validate accuracy (should be positive number if provided)
    if (entry.accuracy !== undefined && entry.accuracy !== null && entry.accuracy !== '') {
      const acc = parseFloat(entry.accuracy)
      if (!isFinite(acc) || acc < 0) {
        errors.push(`Accuracy: must be a positive number (got ${entry.accuracy})`)
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  },

  /**
   * Validate raster bounds
   * @param {object} bounds - { minLat, maxLat, minLon, maxLon }
   * @returns {object} { isValid, errors }
   */
  rasterBounds(bounds) {
    const boundsCheck = coordinateValidators.bounds(bounds)
    return {
      isValid: boundsCheck.isValid,
      errors: boundsCheck.isValid ? [] : [boundsCheck.error]
    }
  }
}

/**
 * Utility function to validate all entry fields
 * @param {object} entry - Complete entry object
 * @returns {object} { isValid, errors, warnings }
 */
export function validateCompleteEntry(entry) {
  const errors = []
  const warnings = []

  // Coordinates are optional. Validate the pair only if either value is filled in,
  // so a bad manual entry is still caught but a blank one is allowed.
  if (entry.latitude || entry.longitude) {
    const coordCheck = coordinateValidators.pair(entry.latitude, entry.longitude)
    if (!coordCheck.isValid) {
      warnings.push(coordCheck.error)
    }
  }

  // Optional fields with validation
  if (entry.date) {
    const dateCheck = timestampValidators.isoDate(entry.date)
    if (!dateCheck.isValid) {
      errors.push(`Date: ${dateCheck.error}`)
    }
  }

  if (entry.localTime) {
    const timeCheck = timestampValidators.time(entry.localTime)
    if (!timeCheck.isValid) {
      warnings.push(`Time: ${timeCheck.error}`)
    }
  }

  if (entry.siteNumber) {
    const num = parseInt(entry.siteNumber)
    if (!isFinite(num) || num < 1) {
      warnings.push('Site number should be a positive integer')
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

logger.debug(MODULE, 'Validation utilities loaded')
