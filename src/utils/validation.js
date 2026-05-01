// Data validation rules for field campaign data
// Validates entry data to prevent typos, impossible values, and data quality issues

const TEMP_MIN = -50
const TEMP_MAX = 50
const GPS_ACCURACY_MIN = 1
const GPS_ACCURACY_MAX = 500
const DEPTH_MAX = 300 // cm, max soil profile depth

export const validateTemperature = (value) => {
  if (value === '' || value === null || value === undefined) return { valid: true }
  const temp = parseFloat(value)
  if (isNaN(temp)) return { valid: false, message: 'Temperature must be a number' }
  if (temp < TEMP_MIN || temp > TEMP_MAX) {
    return {
      valid: false,
      message: `Temperature must be between ${TEMP_MIN}°C and ${TEMP_MAX}°C`,
      outOfRange: true
    }
  }
  return { valid: true }
}

export const validateGpsAccuracy = (value) => {
  if (value === '' || value === null || value === undefined) return { valid: true }
  const accuracy = parseInt(value)
  if (isNaN(accuracy)) return { valid: false, message: 'GPS accuracy must be a number' }
  if (accuracy < GPS_ACCURACY_MIN) {
    return { valid: false, message: `GPS accuracy must be at least ${GPS_ACCURACY_MIN}m` }
  }
  if (accuracy > GPS_ACCURACY_MAX) {
    return {
      valid: false,
      message: `GPS accuracy ${accuracy}m seems unusually high. Check device settings.`,
      warning: true
    }
  }
  return { valid: true }
}

export const validateSoilDepth = (depthFrom, depthTo) => {
  if ((depthFrom === '' || depthFrom === null) && (depthTo === '' || depthTo === null)) {
    return { valid: true } // Both empty is OK
  }

  const from = parseFloat(depthFrom)
  const to = parseFloat(depthTo)

  if (isNaN(from) || isNaN(to)) {
    return { valid: false, message: 'Both depth values must be numbers' }
  }

  if (to <= from) {
    return {
      valid: false,
      message: 'Depth "To" must be greater than "From"'
    }
  }

  if (from < 0 || to < 0) {
    return { valid: false, message: 'Depths cannot be negative' }
  }

  if (from > DEPTH_MAX || to > DEPTH_MAX) {
    return {
      valid: false,
      message: `Soil depth ${Math.max(from, to)}cm exceeds maximum typical profile depth (${DEPTH_MAX}cm)`
    }
  }

  return { valid: true }
}

export const validateActiveLayer = (value) => {
  if (value === '' || value === null || value === undefined) return { valid: true }
  const depth = parseFloat(value)
  if (isNaN(depth)) return { valid: false, message: 'Active layer depth must be a number' }
  if (depth < 0) return { valid: false, message: 'Active layer depth cannot be negative' }
  if (depth > 300) {
    return {
      valid: false,
      message: `Active layer ${depth}cm is unusually deep. Check measurement.`,
      warning: true
    }
  }
  return { valid: true }
}

export const validateOrganicLayer = (value) => {
  if (value === '' || value === null || value === undefined) return { valid: true }
  const depth = parseFloat(value)
  if (isNaN(depth)) return { valid: false, message: 'Organic layer depth must be a number' }
  if (depth < 0) return { valid: false, message: 'Organic layer depth cannot be negative' }
  if (depth > 100) {
    return {
      valid: false,
      message: `Organic layer ${depth}cm is unusually thick. Check measurement.`,
      warning: true
    }
  }
  return { valid: true }
}

export const validateCoordinates = (latitude, longitude) => {
  if ((latitude === '' || latitude === null) && (longitude === '' || longitude === null)) {
    return { valid: true } // Both empty OK
  }

  const lat = parseFloat(latitude)
  const lon = parseFloat(longitude)

  if (isNaN(lat) || isNaN(lon)) {
    return { valid: false, message: 'Coordinates must be numbers' }
  }

  if (lat < -90 || lat > 90) {
    return { valid: false, message: 'Latitude must be between -90 and 90' }
  }

  if (lon < -180 || lon > 180) {
    return { valid: false, message: 'Longitude must be between -180 and 180' }
  }

  // Abisko is at ~68°N, 19°E. Warn if outside northern hemisphere / sensible range
  if (lat < 60 || lat > 75 || lon < -20 || lon > 40) {
    return {
      valid: true,
      warning: true,
      message: 'Coordinates outside typical Arctic research region. Verify GPS.'
    }
  }

  return { valid: true }
}

// Check if vegetation percentages sum logically
// For long description: sum should not exceed 100%
export const validateVegetationPercentages = (vegetationLong) => {
  if (!vegetationLong || vegetationLong.length === 0) return { valid: true }

  const total = vegetationLong.reduce((sum, sp) => sum + (sp.percentage || 0), 0)

  if (total > 100) {
    return {
      valid: false,
      message: `Vegetation percentages sum to ${total}%. Should not exceed 100%.`,
      total
    }
  }

  return { valid: true }
}

export const validateSiteNumber = (value) => {
  if (value === '' || value === null || value === undefined) return { valid: true }
  const siteNum = parseInt(value)
  if (isNaN(siteNum)) return { valid: false, message: 'Site number must be an integer' }
  if (siteNum < 1) return { valid: false, message: 'Site number must be at least 1' }
  if (siteNum > 10000) return { valid: false, message: 'Site number seems too large' }
  return { valid: true }
}

export const validateWindSpeed = (value) => {
  if (value === '' || value === null || value === undefined) return { valid: true }
  const wind = parseFloat(value)
  if (isNaN(wind)) return { valid: false, message: 'Wind speed must be a number' }
  if (wind < 0) return { valid: false, message: 'Wind speed cannot be negative' }
  if (wind > 50) {
    return {
      valid: false,
      message: `Wind speed ${wind} m/s is extremely high. Check measurement.`,
      warning: true
    }
  }
  return { valid: true }
}
