import proj4 from 'proj4'
import logger from './logger'

// Define common projections
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs')
// UTM zones - Northern hemisphere (32600 series)
proj4.defs('EPSG:32608', '+proj=utm +zone=8 +datum=WGS84 +units=m +no_defs') // UTM 8N
proj4.defs('EPSG:32633', '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs') // UTM 33N
proj4.defs('EPSG:32634', '+proj=utm +zone=34 +datum=WGS84 +units=m +no_defs') // UTM 34N
proj4.defs('EPSG:32635', '+proj=utm +zone=35 +datum=WGS84 +units=m +no_defs') // UTM 35N

/**
 * Convert coordinates from source CRS to target CRS
 * @param {number} x - X coordinate (or Longitude)
 * @param {number} y - Y coordinate (or Latitude)
 * @param {string} fromCRS - Source CRS code (e.g., 'EPSG:32634')
 * @param {string} toCRS - Target CRS code (e.g., 'EPSG:4326')
 * @returns {Object} {lon, lat}
 */
export function transformCoordinates(x, y, fromCRS = 'EPSG:4326', toCRS = 'EPSG:4326') {
  try {
    // If same CRS, no transformation needed
    if (fromCRS === toCRS) {
      // Assume x=lon, y=lat for EPSG:4326
      return { lon: x, lat: y }
    }

    // For UTM to lat/lon, x=easting, y=northing
    const result = proj4(fromCRS, toCRS, [x, y])
    return { lon: result[0], lat: result[1] }
  } catch (err) {
    logger.error("coordinateTransform", 'Coordinate transformation failed:', err)
    throw err
  }
}

/**
 * Detect UTM zone from bounds
 * @param {number} lon - Longitude (from geotransform origin)
 * @returns {string} CRS code like 'EPSG:32634'
 */
export function detectUTMZone(lon) {
  // UTM zones are 6 degrees wide
  // Zone 1 is -180 to -174, centered at -177
  const zone = Math.floor((lon + 180) / 6) + 1

  // Determine hemisphere (Northern or Southern)
  // For now assume Northern (N)
  const epsgCode = 32600 + zone // 32600-32660 = Northern hemisphere UTM zones

  return `EPSG:${epsgCode}`
}

/**
 * Determine CRS from geotransform and metadata
 * If origin is in UTM range (200k-900k for most zones), return UTM CRS
 * @param {Array} geotransform - [originX, pixelWidth, 0, originY, 0, -pixelHeight]
 * @param {string} crsHint - CRS hint from GeoTIFF metadata
 * @returns {string} CRS code
 */
export function determineCRS(geotransform, crsHint = 'EPSG:4326') {
  const originX = geotransform[0]
  const originY = geotransform[3]

  // If hint is a valid EPSG code that's not 4326, trust it (likely extracted from metadata)
  if (crsHint && crsHint !== 'EPSG:4326' && crsHint.startsWith('EPSG:')) {
    logger.debug("coordinateTransform", `determineCRS: Using CRS from metadata: ${crsHint}`)
    return crsHint
  }

  // Check if coordinates look like UTM (large values in 200k-900k range)
  // UTM coordinates are typically 500000±400000 in X (easting)
  if (Math.abs(originX) > 100000 && Math.abs(originX) < 1000000 &&
      Math.abs(originY) > 100000 && Math.abs(originY) < 10000000) {

    logger.debug("coordinateTransform", `determineCRS: Coordinates look like UTM - originX=${originX.toFixed(0)}, originY=${originY.toFixed(0)}`)

    // For Abisko (Sweden/Norway border), zones 33, 34, 35 are relevant
    // Each UTM zone is 6 degrees wide and 500000m false easting
    // Without being able to determine exact zone from easting alone, use heuristic:
    // For this project, check the northing to guess zone
    // Zone 34N covers roughly 8°E to 14°E, which would be around x=420000-700000

    let zone = 34  // Default to zone 34 for Abisko region (Sweden)

    if (originX < 400000) {
      zone = 33  // Western (might be zone 33)
    } else if (originX > 700000) {
      zone = 35  // Eastern (might be zone 35)
    }

    if (originY > 0) {
      // Northern hemisphere
      const epsgCode = 32600 + zone
      logger.debug("coordinateTransform", `determineCRS: Detected UTM zone ${zone}N → EPSG:${epsgCode}`)
      return `EPSG:${epsgCode}`
    } else {
      // Southern hemisphere
      const epsgCode = 32700 + zone
      logger.debug("coordinateTransform", `determineCRS: Detected UTM zone ${zone}S → EPSG:${epsgCode}`)
      return `EPSG:${epsgCode}`
    }
  }

  // Default to hint or EPSG:4326
  logger.debug("coordinateTransform", `determineCRS: Using default CRS: ${crsHint}`)
  return crsHint
}

/**
 * Convert pixel to coordinate with CRS handling
 * @param {Object} rasterData - {width, height, pixels, geotransform, bounds, crs}
 * @param {number} pixelX - Pixel X coordinate
 * @param {number} pixelY - Pixel Y coordinate
 * @returns {Object} {lat, lon} in EPSG:4326
 */
export function pixelToCoordinateLonLat(rasterData, pixelX, pixelY) {
  const geotransform = rasterData.geotransform

  // First, get coordinates in the raster's native CRS
  const x = geotransform[0] + pixelX * geotransform[1] + pixelY * geotransform[2]
  const y = geotransform[3] + pixelX * geotransform[4] + pixelY * geotransform[5]

  // Determine source CRS
  const sourceCRS = determineCRS(geotransform, rasterData.crs || 'EPSG:4326')

  logger.debug("coordinateTransform", `pixelToCoordinateLonLat: pixel (${pixelX.toFixed(1)}, ${pixelY.toFixed(1)}) → native CRS (${x.toFixed(1)}, ${y.toFixed(1)}) in ${sourceCRS}`)
  logger.debug("coordinateTransform", `  Geotransform: [${geotransform.map((v, i) => i === 0 || i === 3 ? v.toFixed(0) : v.toFixed(4)).join(', ')}]`)

  // Transform to lat/lon if needed
  if (sourceCRS !== 'EPSG:4326') {
    try {
      const transformed = transformCoordinates(x, y, sourceCRS, 'EPSG:4326')
      logger.debug("coordinateTransform", `  → CRS transform: (${x.toFixed(0)}, ${y.toFixed(0)}) [${sourceCRS}] → (${transformed.lat.toFixed(6)}, ${transformed.lon.toFixed(6)}) [EPSG:4326]`)
      return { lat: transformed.lat, lon: transformed.lon }
    } catch (err) {
      logger.error("coordinateTransform", 'CRS transformation failed:', err)
      throw err
    }
  }

  // Already in lat/lon
  logger.debug("coordinateTransform", `  → already lat/lon: (${y.toFixed(6)}, ${x.toFixed(6)})`)
  return { lat: y, lon: x }
}
