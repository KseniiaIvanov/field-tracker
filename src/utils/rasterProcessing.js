import { fromArrayBuffer } from 'geotiff'
import logger from './logger'
import { transformCoordinates, determineCRS, pixelToCoordinateLonLat } from './coordinateTransform'


export async function parseGeoTIFF(file, targetCRS = 'EPSG:4326') {
  try {
    logger.debug("rasterProcessing", '\n' + '='.repeat(60))
    logger.debug("rasterProcessing", '🚀 START PARSING GEOTIFF:', file.name)
    logger.debug("rasterProcessing", `   Target CRS: ${targetCRS}`)
    logger.debug("rasterProcessing", '='.repeat(60))

    const arrayBuffer = await file.arrayBuffer()
    const tiff = await fromArrayBuffer(arrayBuffer)
    const image = await tiff.getImage()

    const width = image.getWidth()
    const height = image.getHeight()
    const pixelData = await image.readRasters({ pool: null })

    // Check if this is an RGB/RGBA image or single-band
    const samplesPerPixel = image.getSamplesPerPixel()
    logger.debug("rasterProcessing", `📊 DEBUG: samplesPerPixel=${samplesPerPixel}, pixelData.length=${pixelData.length}, pixelData[0] type=${pixelData[0].constructor.name}`)

    let pixels

    if ((samplesPerPixel === 3 || samplesPerPixel === 4) && pixelData.length >= 3) {
      // RGB or RGBA image: combine color bands into single array [R, G, B, R, G, B, ...]
      const isRGBA = samplesPerPixel === 4
      logger.debug("rasterProcessing", `✓ ${isRGBA ? 'RGBA' : 'RGB'} image detected: combining ${samplesPerPixel} bands into RGB format (ignoring ${isRGBA ? 'Alpha' : 'nothing'})`)

      pixels = new Float32Array(width * height * 3)
      const rBand = pixelData[0]
      const gBand = pixelData[1]
      const bBand = pixelData[2]

      for (let i = 0; i < width * height; i++) {
        pixels[i * 3] = rBand[i]      // R
        pixels[i * 3 + 1] = gBand[i]  // G
        pixels[i * 3 + 2] = bBand[i]  // B
        // Ignore alpha channel (pixelData[3]) if present
      }
      logger.debug("rasterProcessing", `✓ RGB pixels created: ${pixels.length} total values (${width}×${height}×3)`)
    } else {
      // Single-band image: use first band as-is
      logger.debug("rasterProcessing", `ℹ️ Single-band/grayscale image (samplesPerPixel=${samplesPerPixel})`)
      pixels = new Float32Array(pixelData[0])
    }

    // NOTE: parseBounds() is called later after geotransform is available
    // Using parseBounds() here causes garbage pixel coordinates for some GeoTIFF files
    let bounds = null

    // Extract CRS safely - try multiple methods for robustness
    let crs = 'EPSG:4326' // default fallback
    let crsDetectionMethod = 'DEFAULT'

    // METHOD 1: Use getGeoKeys() - this is the proper async method to get GeoTIFF metadata
    logger.debug("rasterProcessing", '🔍 CRS Detection - Trying getGeoKeys() method...')
    if (typeof image.getGeoKeys === 'function') {
      try {
        const geoKeys = await image.getGeoKeys()
        if (geoKeys) {
          logger.debug("rasterProcessing", '   ✓ getGeoKeys() succeeded, keys:', Object.keys(geoKeys).join(', '))
          logger.debug("rasterProcessing", '   ProjectedCSTypeGeoKey:', geoKeys?.ProjectedCSTypeGeoKey)
          logger.debug("rasterProcessing", '   GeographicTypeGeoKey:', geoKeys?.GeographicTypeGeoKey)

          // ProjectedCSTypeGeoKey is used for projected coordinates (UTM, etc)
          if (geoKeys && geoKeys.ProjectedCSTypeGeoKey) {
            const val = geoKeys.ProjectedCSTypeGeoKey
            crs = typeof val === 'number' ? `EPSG:${val}` : String(val)
            crsDetectionMethod = 'getGeoKeys-Projected'
            logger.debug("rasterProcessing", '   ✅ Found ProjectedCSTypeGeoKey:', crs)
          }
          // GeographicTypeGeoKey is used for geographic coordinates (lat/lon)
          else if (geoKeys && geoKeys.GeographicTypeGeoKey) {
            const val = geoKeys.GeographicTypeGeoKey
            crs = typeof val === 'number' ? `EPSG:${val}` : String(val)
            crsDetectionMethod = 'getGeoKeys-Geographic'
            logger.debug("rasterProcessing", '   ✅ Found GeographicTypeGeoKey:', crs)
          } else {
            logger.warn("rasterProcessing", '   ⚠️ getGeoKeys() returned empty or no CRS keys')
          }
          // Also check GTCitationGeoKey for human-readable CRS description
          if (geoKeys && geoKeys.GTCitationGeoKey) {
            logger.debug("rasterProcessing", '   CRS Citation:', geoKeys.GTCitationGeoKey)
          }
        } else {
          logger.warn("rasterProcessing", '   ⚠️ getGeoKeys() returned null/undefined')
        }
      } catch (e) {
        logger.warn("rasterProcessing", `   ⚠️ getGeoKeys() failed: ${e.message}`)
      }
    } else {
      logger.warn("rasterProcessing", '   ⚠️ getGeoKeys() method not available')
    }

    // METHOD 2: Fallback to synchronous geoKeys property (older geotiff.js versions)
    if (crsDetectionMethod === 'DEFAULT') {
      logger.debug("rasterProcessing", '🔍 CRS Detection - Trying image.geoKeys property...')
      const geoKeys = image.geoKeys || {}
      logger.debug("rasterProcessing", '   Found geoKeys keys:', Object.keys(geoKeys).join(', ') || '(empty)')

      if (geoKeys.ProjectedCSTypeGeoKey) {
        const val = geoKeys.ProjectedCSTypeGeoKey
        crs = typeof val === 'number' ? `EPSG:${val}` : String(val)
        crsDetectionMethod = 'geoKeys-Projected'
        logger.debug("rasterProcessing", '   ✅ Found ProjectedCSTypeGeoKey:', crs)
      } else if (geoKeys.GeographicTypeGeoKey) {
        const val = geoKeys.GeographicTypeGeoKey
        crs = typeof val === 'number' ? `EPSG:${val}` : String(val)
        crsDetectionMethod = 'geoKeys-Geographic'
        logger.debug("rasterProcessing", '   ✅ Found GeographicTypeGeoKey:', crs)
      } else {
        logger.warn("rasterProcessing", '   ⚠️ No CRS found in image.geoKeys, using default EPSG:4326')
      }
    }

    logger.debug("rasterProcessing", `✅ Final extracted CRS: ${crs} (method: ${crsDetectionMethod})`)

    // Calculate min/max safely without creating full array copy
    let minValue = Infinity
    let maxValue = -Infinity
    let hasValidPixels = false

    for (let i = 0; i < pixels.length; i++) {
      const p = pixels[i]
      if (isFinite(p)) {
        hasValidPixels = true
        if (p < minValue) minValue = p
        if (p > maxValue) maxValue = p
      }
    }

    if (!hasValidPixels) {
      minValue = 0
      maxValue = 1
    }

    const geotransform = await parseGeotransform(image)

    // No AUTO-FIX assumptions! Trust only GeoTIFF metadata
    // Web Mercator (3857) needs proper transformation to target CRS
    if (crs === 'EPSG:3857') {
      logger.debug("rasterProcessing", `ℹ️ Web Mercator (EPSG:3857) detected. Will transform to target CRS`)
    } else if (crs && !crs.includes('4326') && !crs.includes('32634') && !crs.includes('3857')) {
      // Unknown CRS - log warning but don't assume
      logger.warn("rasterProcessing", `⚠️ Unknown CRS detected: ${crs}. This raster may not align with others.`)
      logger.warn("rasterProcessing", `   For best results, ensure all rasters have CRS metadata (EPSG:4326 or EPSG:32634)`)
    }

    // CALCULATE BOUNDS FROM GEOTRANSFORM (not from parseBounds)
    // Geotransform is reliable and available for all georeferenced GeoTIFFs
    // parseBounds() fails silently for some files, returning pixel coordinates instead of geographic
    const [originX, pixelWidth, , originY, , pixelHeight] = geotransform

    logger.debug("rasterProcessing", `📐 Calculating bounds from geotransform:`)
    logger.debug("rasterProcessing", `   Origin: (${originX.toFixed(1)}, ${originY.toFixed(1)})`)
    logger.debug("rasterProcessing", `   Image size: ${width} × ${height} pixels`)
    logger.debug("rasterProcessing", `   Pixel scale: (${pixelWidth.toFixed(6)}, ${pixelHeight.toFixed(6)})`)
    logger.debug("rasterProcessing", `   Calculation: east = ${originX.toFixed(1)} + ${width} × ${pixelWidth.toFixed(6)} = ${(originX + width * pixelWidth).toFixed(1)}`)
    logger.debug("rasterProcessing", `   Calculation: south = ${originY.toFixed(1)} + ${height} × ${pixelHeight.toFixed(6)} = ${(originY + height * pixelHeight).toFixed(1)}`)

    let rawEast = originX + width * pixelWidth
    let rawSouth = originY + height * pixelHeight

    // Ensure bounds are always ordered correctly: west < east, south < north
    bounds = {
      west: Math.min(originX, rawEast),
      east: Math.max(originX, rawEast),
      north: Math.max(originY, rawSouth),
      south: Math.min(originY, rawSouth)
    }
    logger.debug("rasterProcessing", `✓ Bounds (normalized): west=${bounds.west.toFixed(4)}, east=${bounds.east.toFixed(4)}, north=${bounds.north.toFixed(4)}, south=${bounds.south.toFixed(4)}`)

    // Validate critical metadata
    if (!geotransform || geotransform.length < 6) {
      throw new Error('❌ Missing geotransform metadata! This file may not be a valid georeferenced GeoTIFF. The file needs proper coordinate system information (geotransform with 6 parameters).')
    }

    // CRITICAL CHECK: Bounds must NOT be degenerate (single point)
    if (!bounds || Object.keys(bounds).length === 0) {
      throw new Error('❌ Missing coordinate bounds! This file may not contain valid geographic metadata. The file needs ModelTiepoint or PixelScale tags.')
    }

    const boundsWidth = Math.abs(bounds.east - bounds.west)
    const boundsHeight = Math.abs(bounds.north - bounds.south)
    logger.debug("rasterProcessing", `📏 Bounds dimensions: width=${boundsWidth.toFixed(4)}, height=${boundsHeight.toFixed(4)}`)

    // WARN if bounds are degenerate, but don't block upload
    // The auto-fix mechanism should have recovered pixel scale, but if not, we continue anyway
    // The raster may have been created without proper geotransform metadata
    if (boundsWidth === 0 || boundsHeight === 0) {
      logger.warn("rasterProcessing", `⚠️ WARNING: Degenerate bounds detected!`)
      logger.warn("rasterProcessing", `   Bounds width: ${boundsWidth}, height: ${boundsHeight}`)
      logger.warn("rasterProcessing", `   Geotransform: [${originX}, ${pixelWidth}, 0, ${originY}, 0, ${-pixelHeight}]`)
      logger.warn("rasterProcessing", `   This file appears to have invalid or missing geotransform metadata.`)
      logger.warn("rasterProcessing", `   Sites may not align correctly. Use gdalinfo to check the file.`)
      // Don't throw - allow upload to continue, but bounds will not be useful
    }

    // Transform bounds to target CRS if needed
    let finalBounds = bounds
    let finalCRS = crs
    let finalGeotransform = geotransform

    if (crs !== targetCRS) {
      logger.debug("rasterProcessing", `🔄 Transforming bounds from ${crs} to ${targetCRS}...`)
      logger.debug("rasterProcessing", `   Original bounds in ${crs}: ${JSON.stringify(bounds)}`)
      try {
        // Transform all 4 corners of bounds to target CRS
        const nw = transformCoordinates(bounds.west, bounds.north, crs, targetCRS)
        const ne = transformCoordinates(bounds.east, bounds.north, crs, targetCRS)
        const sw = transformCoordinates(bounds.west, bounds.south, crs, targetCRS)
        const se = transformCoordinates(bounds.east, bounds.south, crs, targetCRS)

        // Calculate new bounds that encompass all transformed points
        const newWest = Math.min(nw.lon, ne.lon, sw.lon, se.lon)
        const newEast = Math.max(nw.lon, ne.lon, sw.lon, se.lon)
        const newNorth = Math.max(nw.lat, ne.lat, sw.lat, se.lat)
        const newSouth = Math.min(nw.lat, ne.lat, sw.lat, se.lat)

        finalBounds = {
          west: newWest,
          east: newEast,
          north: newNorth,
          south: newSouth
        }
        finalCRS = targetCRS

        // CRITICAL: Recalculate geotransform for new CRS!
        // Pixel-to-coordinate mapping MUST match the CRS
        // For BOTH geographic (WGS84) and projected (UTM) systems
        let newPixelWidth = (finalBounds.east - finalBounds.west) / width
        let newPixelHeight = -(finalBounds.north - finalBounds.south) / height

        // VALIDATE: Ensure pixel scales are finite and non-zero
        if (!isFinite(newPixelWidth) || newPixelWidth === 0) {
          logger.error("rasterProcessing", `❌ CRITICAL: Transformed bounds produced invalid pixelWidth=${newPixelWidth}`)
          logger.error("rasterProcessing", `   Original bounds: ${JSON.stringify(bounds)}`)
          logger.error("rasterProcessing", `   Transformed bounds: ${JSON.stringify(finalBounds)}`)
          logger.error("rasterProcessing", `   Width (pixels): ${width}`)
          logger.error("rasterProcessing", `   Using fallback: pixelWidth = 1.0`)
          newPixelWidth = 1.0
        }

        if (!isFinite(newPixelHeight) || newPixelHeight === 0) {
          logger.error("rasterProcessing", `❌ CRITICAL: Transformed bounds produced invalid pixelHeight=${newPixelHeight}`)
          logger.error("rasterProcessing", `   Height (pixels): ${height}`)
          logger.error("rasterProcessing", `   Using fallback: pixelHeight = 1.0`)
          newPixelHeight = 1.0
        }

        finalGeotransform = [
          finalBounds.west,     // origin in new CRS
          newPixelWidth,        // pixel size in new CRS units
          0,
          finalBounds.north,    // origin in new CRS
          0,
          newPixelHeight        // pixel size in new CRS units (negative)
        ]

        logger.debug("rasterProcessing", `✅ Bounds transformed to ${targetCRS}: ${JSON.stringify(finalBounds)}`)
        logger.debug("rasterProcessing", `   New geotransform: [${finalGeotransform[0].toFixed(4)}, ${finalGeotransform[1].toFixed(9)}, 0, ${finalGeotransform[3].toFixed(4)}, 0, ${finalGeotransform[5].toFixed(9)}]`)
      } catch (err) {
        logger.warn("rasterProcessing", `⚠️ Failed to transform bounds: ${err.message}, using original bounds`)
      }
    }

    logger.debug("rasterProcessing", 'GeoTIFF parsed:', {
      width, height,
      bounds: finalBounds,
      crs: finalCRS,
      minValue, maxValue,
      geotransform: finalGeotransform
    })

    return {
      width,
      height,
      pixels,
      geotransform: finalGeotransform,
      bounds: finalBounds,
      crs: finalCRS,
      metadata: {
        minValue,
        maxValue,
        dataType: pixelData[0].constructor.name,
        samplesPerPixel: image.getSamplesPerPixel(),
        originalCRS: crs  // Keep original CRS for reference
      }
    }
  } catch (error) {
    throw new Error(`Failed to parse GeoTIFF: ${error.message}`, { cause: error })
  }
}

async function parseGeotransform(image) {
  // Robust GeoTIFF geotransform extraction
  // Handles multiple data formats from different GIS software
  // Returns [originX, pixelWidth, 0, originY, 0, -pixelHeight]

  let originX = 0, originY = 0, pixelWidth = 1, pixelHeight = 1
  let tiepointArray = null, pixelScaleArray = null

  logger.debug("rasterProcessing", '📐 parseGeotransform: Starting extraction...')

  // Try all possible sources for tiepoint data
  const geoKeys = image.geoKeys || {}

  // Source 1: geoKeys properties
  if (geoKeys.ModelTiepoint) {
    tiepointArray = geoKeys.ModelTiepoint
    logger.debug("rasterProcessing", '   ✓ Found ModelTiepoint in geoKeys')
  } else if (geoKeys.TiePoints) {
    tiepointArray = geoKeys.TiePoints
    logger.debug("rasterProcessing", '   ✓ Found TiePoints in geoKeys')
  }

  if (geoKeys.ModelPixelScale) {
    pixelScaleArray = geoKeys.ModelPixelScale
    logger.debug("rasterProcessing", `   ✓ Found ModelPixelScale in geoKeys: ${JSON.stringify(pixelScaleArray)}`)
  } else if (geoKeys.PixelScale) {
    pixelScaleArray = geoKeys.PixelScale
    logger.debug("rasterProcessing", `   ✓ Found PixelScale in geoKeys: ${JSON.stringify(pixelScaleArray)}`)
  }

  // Source 2: geotiff.js methods
  if (!tiepointArray && typeof image.getTiePoints === 'function') {
    try {
      const tp = await Promise.resolve(image.getTiePoints())
      if (Array.isArray(tp) && tp.length > 0) {
        tiepointArray = tp
        logger.debug("rasterProcessing", '   ✓ Got TiePoints from getTiePoints()')
      }
    } catch (e) {
      logger.debug("rasterProcessing", `   ⚠️ getTiePoints failed: ${e.message}`)
    }
  }

  if (!pixelScaleArray && typeof image.getPixelScale === 'function') {
    try {
      const ps = await Promise.resolve(image.getPixelScale())
      if (Array.isArray(ps) && ps.length >= 2) {
        pixelScaleArray = ps
        logger.debug("rasterProcessing", `   ✓ Got PixelScale from getPixelScale(): ${JSON.stringify(ps)}`)
      }
    } catch (e) {
      logger.debug("rasterProcessing", `   ⚠️ getPixelScale failed: ${e.message}`)
    }
  }

  // Source 3: fileDirectory
  if (image.fileDirectory && (!tiepointArray || !pixelScaleArray)) {
    const fd = image.fileDirectory
    if (fd.ModelTiepoint && !tiepointArray) {
      tiepointArray = fd.ModelTiepoint
      logger.debug("rasterProcessing", '   ✓ Found ModelTiepoint in fileDirectory')
    }
    if (fd.ModelPixelScale && !pixelScaleArray) {
      pixelScaleArray = fd.ModelPixelScale
      logger.debug("rasterProcessing", `   ✓ Found ModelPixelScale in fileDirectory: ${JSON.stringify(pixelScaleArray)}`)
    }
  }

  // Extract pixel scale FIRST (handle both object and array formats)
  // This must be done before processing tiepoint to correctly calculate origin
  if (pixelScaleArray) {
    if (typeof pixelScaleArray === 'object' && pixelScaleArray.x !== undefined) {
      // Validate object format values
      const objWidth = pixelScaleArray.x
      const objHeight = pixelScaleArray.y

      if (typeof objWidth === 'number' && isFinite(objWidth) && objWidth !== 0) {
        pixelWidth = objWidth
        logger.debug("rasterProcessing", `   ✓ Extracted pixel scale from object format: width=${pixelWidth}`)
      } else {
        logger.warn("rasterProcessing", `   ⚠️ Object format pixelWidth is invalid (${typeof objWidth}: ${objWidth}), keeping default 1.0`)
      }

      if (typeof objHeight === 'number' && isFinite(objHeight) && objHeight !== 0) {
        pixelHeight = objHeight
        logger.debug("rasterProcessing", `   ✓ Extracted pixel scale from object format: height=${pixelHeight}`)
      } else {
        logger.warn("rasterProcessing", `   ⚠️ Object format pixelHeight is invalid (${typeof objHeight}: ${objHeight}), keeping default 1.0`)
      }
    } else if (Array.isArray(pixelScaleArray)) {
      // CRITICAL FIX: Don't use || 1 if value is 0, as 0 is falsy but valid in some contexts
      // Instead, check if the value is a number
      const rawWidth = pixelScaleArray[0]
      const rawHeight = pixelScaleArray[1]

      logger.debug("rasterProcessing", `   Raw PixelScale array values: [${rawWidth}, ${rawHeight}]`)

      if (typeof rawWidth === 'number' && isFinite(rawWidth) && rawWidth !== 0) {
        pixelWidth = rawWidth
        logger.debug("rasterProcessing", `      ✓ Using PixelScale[0]: ${pixelWidth}`)
      } else {
        logger.warn("rasterProcessing", `      ⚠️ PixelScale[0] is invalid (${typeof rawWidth}: ${rawWidth}), keeping default 1.0`)
      }

      if (typeof rawHeight === 'number' && isFinite(rawHeight) && rawHeight !== 0) {
        pixelHeight = rawHeight
        logger.debug("rasterProcessing", `      ✓ Using PixelScale[1]: ${pixelHeight}`)
      } else {
        logger.warn("rasterProcessing", `      ⚠️ PixelScale[1] is invalid (${typeof rawHeight}: ${rawHeight}), keeping default 1.0`)
      }

      logger.debug("rasterProcessing", `   ✓ Extracted pixel scale from array format: width=${pixelWidth}, height=${pixelHeight}`)
    }
  } else {
    logger.warn("rasterProcessing", '   ⚠️ No PixelScale found in any source, using default 1.0')
    logger.warn("rasterProcessing", `   DEBUG: pixelScaleArray=${pixelScaleArray}, type=${typeof pixelScaleArray}`)
  }

  // AUTO-FIX: Recover pixel scale from getBoundingBox() BEFORE using in origin calculations
  // Some GeoTIFF files don't have ModelPixelScale tag but have valid bounds
  // Trigger if EITHER pixel scale is invalid (not found, zero, NaN, or still at default)
  const pixelWidthInvalid = !isFinite(pixelWidth) || pixelWidth === 0 || pixelWidth === 1
  const pixelHeightInvalid = !isFinite(pixelHeight) || pixelHeight === 0 || pixelHeight === 1
  if (pixelWidthInvalid || pixelHeightInvalid) {
    if (pixelWidthInvalid && pixelHeightInvalid) {
      logger.debug("rasterProcessing", `   🔧 BOTH pixel scales invalid/default (${pixelWidth}, ${pixelHeight}), attempting to recover from BoundingBox...`)
    } else {
      logger.debug("rasterProcessing", `   🔧 One or more pixel scales invalid (width=${pixelWidth}, height=${pixelHeight}), attempting to recover from BoundingBox...`)
    }

    try {
      if (typeof image.getBoundingBox === 'function') {
        const bbox = await Promise.resolve(image.getBoundingBox())
        if (bbox && Array.isArray(bbox) && bbox.length === 4) {
          const [west, south, east, north] = bbox
          const boundsWidth = east - west
          const boundsHeight = north - south

          if (boundsWidth > 0 && boundsHeight > 0) {
            const recoveredPixelWidth = boundsWidth / image.getWidth()
            const recoveredPixelHeight = boundsHeight / image.getHeight()

            if (isFinite(recoveredPixelWidth) && isFinite(recoveredPixelHeight) &&
                recoveredPixelWidth > 0 && recoveredPixelHeight > 0) {
              logger.debug("rasterProcessing", `   ✅ AUTO-FIX: Recovered PixelScale from BoundingBox`)
              logger.debug("rasterProcessing", `      BoundingBox: [${west}, ${south}, ${east}, ${north}]`)
              logger.debug("rasterProcessing", `      Calculated pixelWidth: ${recoveredPixelWidth.toFixed(9)}`)
              logger.debug("rasterProcessing", `      Calculated pixelHeight: ${recoveredPixelHeight.toFixed(9)}`)
              pixelWidth = recoveredPixelWidth
              pixelHeight = recoveredPixelHeight
            } else {
              logger.warn("rasterProcessing", `   ⚠️ AUTO-FIX: Calculated invalid pixel scales`)
            }
          } else {
            logger.warn("rasterProcessing", `   ⚠️ AUTO-FIX: BoundingBox has invalid dimensions`)
          }
        } else {
          logger.warn("rasterProcessing", `   ⚠️ AUTO-FIX: BoundingBox returned invalid format`)
        }
      }
    } catch (e) {
      logger.warn("rasterProcessing", `   ⚠️ AUTO-FIX failed: ${e.message}`)
    }
  }

  // Extract origin from tiepoint (handle both object and array formats)
  // The tiepoint specifies [pixelCol, pixelRow, ..., worldX, worldY, ...]
  // If tiepoint is not at pixel (0,0), we must adjust to get the true origin
  logger.debug("rasterProcessing", `   DEBUG: tiepointArray = ${tiepointArray ? JSON.stringify(tiepointArray) : 'null'}, type=${typeof tiepointArray}`)

  if (tiepointArray && tiepointArray.length > 0) {
    logger.debug("rasterProcessing", `   Tiepoint length=${tiepointArray.length}, first element type=${typeof tiepointArray[0]}`)

    if (typeof tiepointArray[0] === 'object' && tiepointArray[0].x !== undefined) {
      // Object format: {col, row, x, y, z}
      const pixelColAtTiepoint = tiepointArray[0].col || 0
      const pixelRowAtTiepoint = tiepointArray[0].row || 0
      originX = tiepointArray[0].x - pixelColAtTiepoint * pixelWidth
      originY = tiepointArray[0].y + pixelRowAtTiepoint * pixelHeight
      logger.debug("rasterProcessing", `   ✓ Object format tiepoint: col=${pixelColAtTiepoint}, row=${pixelRowAtTiepoint}, x=${tiepointArray[0].x}, y=${tiepointArray[0].y}`)
      if (pixelColAtTiepoint !== 0 || pixelRowAtTiepoint !== 0) {
        logger.debug("rasterProcessing", `   Tiepoint at pixel (${pixelColAtTiepoint}, ${pixelRowAtTiepoint}), adjusted origin`)
      }
    } else if (Array.isArray(tiepointArray) && tiepointArray.length >= 5) {
      // Array format: [pixelCol, pixelRow, pixelZ, worldX, worldY, ...]
      const pixelColAtTiepoint = tiepointArray[0] || 0
      const pixelRowAtTiepoint = tiepointArray[1] || 0
      const worldX = tiepointArray[3]
      const worldY = tiepointArray[4]
      logger.debug("rasterProcessing", `   ✓ Array format tiepoint: [${tiepointArray[0]}, ${tiepointArray[1]}, ${tiepointArray[2]}, ${tiepointArray[3]}, ${tiepointArray[4]}, ...]`)
      logger.debug("rasterProcessing", `     pixelCol=${pixelColAtTiepoint}, pixelRow=${pixelRowAtTiepoint}, worldX=${worldX}, worldY=${worldY}`)
      logger.debug("rasterProcessing", `     pixelWidth=${pixelWidth}, pixelHeight=${pixelHeight}`)

      originX = worldX - pixelColAtTiepoint * pixelWidth
      originY = worldY + pixelRowAtTiepoint * pixelHeight

      logger.debug("rasterProcessing", `     Calculated: originX = ${worldX} - ${pixelColAtTiepoint} * ${pixelWidth} = ${originX}`)
      logger.debug("rasterProcessing", `     Calculated: originY = ${worldY} + ${pixelRowAtTiepoint} * ${pixelHeight} = ${originY}`)

      if (pixelColAtTiepoint !== 0 || pixelRowAtTiepoint !== 0) {
        logger.debug("rasterProcessing", `   Tiepoint at pixel (${pixelColAtTiepoint}, ${pixelRowAtTiepoint}), adjusted origin`)
      }
    } else {
      logger.warn("rasterProcessing", `   ⚠️ Tiepoint format not recognized: ${JSON.stringify(tiepointArray).substring(0, 100)}...`)
    }
    logger.debug("rasterProcessing", `   ✓ Extracted origin from tiepoint: (${originX.toFixed(6)}, ${originY.toFixed(6)})`)
  } else {
    logger.warn("rasterProcessing", '   ⚠️ No tiepoint found, origin will be (0, 0)')
  }

  // FINAL VALIDATION: Ensure pixel scale is never 0 or NaN
  // For high-resolution rasters (like 1m resolution at ~0.00001°), very small scales are valid
  if (!isFinite(pixelWidth) || pixelWidth === 0) {
    logger.error("rasterProcessing", `   ❌ CRITICAL: pixelWidth is ${pixelWidth}, defaulting to 1.0`)
    pixelWidth = 1.0
  }
  if (!isFinite(pixelHeight) || pixelHeight === 0) {
    logger.error("rasterProcessing", `   ❌ CRITICAL: pixelHeight is ${pixelHeight}, defaulting to 1.0`)
    pixelHeight = 1.0
  }

  const geotransform = [
    originX,
    pixelWidth,
    0,
    originY,
    0,
    -pixelHeight
  ]

  // CRITICAL: DOUBLE-CHECK that geotransform[1] and geotransform[5] are never zero
  // If they are, this geotransform is DEGENERATE and will cause coordinate transformation to fail
  if (geotransform[1] === 0 || geotransform[1] === undefined || !isFinite(geotransform[1])) {
    logger.error("rasterProcessing", `   ❌ CRITICAL: Geotransform[1] (pixelWidth) is ${geotransform[1]} - MUST BE NON-ZERO!`)
    logger.error("rasterProcessing", `   This will cause degenerate transform. Forcing to 1.0`)
    geotransform[1] = 1.0
  }

  if (geotransform[5] === 0 || geotransform[5] === undefined || !isFinite(geotransform[5])) {
    logger.error("rasterProcessing", `   ❌ CRITICAL: Geotransform[5] (-pixelHeight) is ${geotransform[5]} - MUST BE NON-ZERO!`)
    logger.error("rasterProcessing", `   This will cause degenerate transform. Forcing to -1.0`)
    geotransform[5] = -1.0
  }

  logger.debug("rasterProcessing", '✓ parseGeotransform FINAL result:')
  logger.debug("rasterProcessing", `    Origin: (${originX.toFixed(6)}, ${originY.toFixed(6)})`)
  logger.debug("rasterProcessing", `    Pixel scale: width=${pixelWidth.toFixed(9)}, height=${pixelHeight.toFixed(9)}`)
  logger.debug("rasterProcessing", `    Full geotransform array: [${geotransform.map((v, i) => `${v.toFixed(i === 0 || i === 3 ? 6 : 9)}`).join(', ')}]`)

  // Log the actual array values for debugging
  logger.debug("rasterProcessing", `    Raw geotransform values:`)
  for (let i = 0; i < geotransform.length; i++) {
    logger.debug("rasterProcessing", `      [${i}]: ${geotransform[i]} (type: ${typeof geotransform[i]})`)
  }

  return geotransform
}

export function pixelToCoordinate(rasterData, pixelX, pixelY) {
  const geotransform = rasterData.geotransform
  const x = geotransform[0] + pixelX * geotransform[1] + pixelY * geotransform[2]
  const y = geotransform[3] + pixelX * geotransform[4] + pixelY * geotransform[5]
  return { lat: y, lon: x }
}

export function coordinateToPixel(rasterData, lat, lon) {
  const geotransform = rasterData.geotransform

  // Use rasterData.crs directly — it's already determined during parsing
  // No need to re-determine for every pixel!
  const sourceCRS = rasterData.crs || 'EPSG:4326'

  // Debug: check for invalid geotransform
  if (!geotransform || geotransform.length < 6) {
    logger.error("rasterProcessing", `❌ coordinateToPixel: Invalid geotransform!`, geotransform)
    throw new Error('Invalid geotransform in coordinateToPixel')
  }

  // If raster is in UTM, convert input lat/lon to UTM
  let x
  let y
  if (sourceCRS !== 'EPSG:4326') {
    try {
      const transformed = transformCoordinates(lon, lat, 'EPSG:4326', sourceCRS)
      x = transformed.lon // In UTM, this is easting
      y = transformed.lat // In UTM, this is northing

      // DEBUG: Log transformation for sites around Abisko
      if (lon > 15 && lon < 25 && lat > 60 && lat < 75) {
        logger.debug("rasterProcessing", `🔄 coordinateToPixel: Transformed site [${lon.toFixed(4)}, ${lat.toFixed(4)}] (lat/lon) → [${x.toFixed(1)}, ${y.toFixed(1)}] (${sourceCRS})`)
      }

      if (!isFinite(x) || !isFinite(y)) {
        logger.error("rasterProcessing", `❌ coordinateToPixel: Transformation produced NaN! [${lon}, ${lat}] → [${x}, ${y}]`)
        throw new Error('Coordinate transformation produced NaN')
      }
    } catch (err) {
      logger.error("rasterProcessing", `❌ coordinateToPixel: Transform failed for [${lon}, ${lat}] to ${sourceCRS}:`, err.message)
      throw err
    }
  } else {
    // Already in WGS84, no transformation needed
    x = lon
    y = lat
  }

  const a = geotransform[1]
  const b = geotransform[2]
  const c = geotransform[0]  // originX
  const d = geotransform[4]
  const e = geotransform[5]
  const f = geotransform[3]  // originY

  // DEBUG: Show raster bounds in its native CRS (helpful for UTM rasters)
  if (sourceCRS !== 'EPSG:4326' && lon > 15 && lon < 25 && lat > 60 && lat < 75) {
    const eastMax = c + rasterData.width * a
    const northMin = f + rasterData.height * e  // e is negative, so this goes down
    logger.debug("rasterProcessing", `📍 Raster bounds in ${sourceCRS}: X[${c.toFixed(1)}-${eastMax.toFixed(1)}], Y[${northMin.toFixed(1)}-${f.toFixed(1)}]`)
  }

  const det = a * e - b * d

  // For high-resolution rasters (small pixel scales like 0.00001°),
  // the determinant will naturally be very small.
  // So check relative to the scale of the matrix elements, not absolute value.
  // A matrix is singular if det ≈ 0 relative to its magnitude.
  const matrixScale = Math.abs(a) * Math.abs(e)
  const isDegenerateMatrix = matrixScale > 1e-15 && Math.abs(det) < matrixScale * 1e-10

  if (isDegenerateMatrix) {
    logger.error("rasterProcessing", `❌ coordinateToPixel: Invalid geotransform matrix! det=${det}, matrixScale=${matrixScale}`)
    logger.error("rasterProcessing", `   geotransform: [${a}, ${b}, ${c}, ${d}, ${e}, ${f}]`)
    throw new Error('Invalid geotransform matrix')
  }

  // Also check for actual zeros in the scaling factors (true singularity)
  if (a === 0 || e === 0) {
    logger.error("rasterProcessing", `❌ coordinateToPixel: Degenerate matrix - zero pixel scale! a=${a}, e=${e}`)
    throw new Error('Zero pixel scale in geotransform')
  }

  const pixelX = ((x - c) * e - (y - f) * b) / det
  const pixelY = ((y - f) * a - (x - c) * d) / det

  // Debug first site conversion
  if (lon > 15 && lon < 25 && lat > 60 && lat < 75) {
    logger.debug("rasterProcessing", `DEBUG coordinateToPixel: [${lon.toFixed(3)}, ${lat.toFixed(3)}] (${sourceCRS})`)
    logger.debug("rasterProcessing", `  c=${c}, f=${f}, a=${a.toFixed(6)}, b=${b.toFixed(6)}, e=${e.toFixed(6)}`)
    logger.debug("rasterProcessing", `  det=${det.toFixed(9)}, pixelX=${pixelX.toFixed(1)}, pixelY=${pixelY.toFixed(1)}`)
  }

  if (!isFinite(pixelX) || !isFinite(pixelY)) {
    logger.error("rasterProcessing", `❌ coordinateToPixel: Pixel calculation produced NaN!`)
    logger.error("rasterProcessing", `   Input: [${lon}, ${lat}], Transformed: [${x}, ${y}]`)
    logger.error("rasterProcessing", `   Geotransform: [${a}, ${b}, ${c}, ${d}, ${e}, ${f}]`)
    logger.error("rasterProcessing", `   Pixel: [${pixelX}, ${pixelY}]`)
    throw new Error('Pixel calculation produced NaN')
  }

  return {
    x: Math.round(pixelX),
    y: Math.round(pixelY)
  }
}

// Centralized NoData / NA detection. Treats common GeoTIFF fill sentinels
// (-9999, -9998, -32768, huge positives), NaN/Inf, and the raster's declared
// noData value as missing. Used everywhere a pixel value is read so -9999 never
// leaks into histograms, stats, the priority grid, or the planner table.
export function isNoDataValue(value, rasterData = null) {
  if (value === null || value === undefined || !isFinite(value)) return true
  if (rasterData && rasterData.noData != null && isFinite(rasterData.noData) && value === rasterData.noData) return true
  if (value <= -9000) return true   // -9999, -9998, -32768, etc.
  if (value >= 1e20) return true    // large positive fill
  return false
}

export function getPixelValue(rasterData, pixelX, pixelY) {
  if (pixelX < 0 || pixelX >= rasterData.width || pixelY < 0 || pixelY >= rasterData.height) {
    return null
  }
  const index = pixelY * rasterData.width + pixelX
  const value = rasterData.pixels[index]

  // Treat NoData / NA sentinels as missing so they're excluded everywhere downstream
  if (isNoDataValue(value, rasterData)) return null

  // Debug: log pixel value type on first call
  if (!window._pixelDebugLogged) {
    window._pixelDebugLogged = true
    logger.debug("rasterProcessing", `🔍 getPixelValue DEBUG:`)
    logger.debug("rasterProcessing", `   pixels type: ${rasterData.pixels.constructor.name}`)
    logger.debug("rasterProcessing", `   pixels length: ${rasterData.pixels.length}`)
    logger.debug("rasterProcessing", `   Sample values [0,1,2]: [${rasterData.pixels[0]}, ${rasterData.pixels[1]}, ${rasterData.pixels[2]}]`)
    logger.debug("rasterProcessing", `   Width: ${rasterData.width}, Height: ${rasterData.height}`)
    logger.debug("rasterProcessing", `   First pixel (0,0) index=0, value=${rasterData.pixels[0]}`)
  }

  return value
}

export function extractValueAtBuffer(rasterData, lat, lon, accuracyMeters) {
  try {
    const centerPixel = coordinateToPixel(rasterData, lat, lon)
    const radiusInPixels = metersToPixels(rasterData, accuracyMeters)

    // Debug logging for first few sites
    if (!window._debugLogged) {
      window._debugLogged = 0
    }
    window._debugLogged++

    if (window._debugLogged <= 3) {
      logger.debug("rasterProcessing", `     [BUFFER ${window._debugLogged}] Input: [${lon}, ${lat}] → Pixel: [${centerPixel.x}, ${centerPixel.y}], Radius: ${radiusInPixels}px`)
    }

    const values = []
    const minX = Math.max(0, Math.floor(centerPixel.x - radiusInPixels))
    const maxX = Math.min(rasterData.width - 1, Math.ceil(centerPixel.x + radiusInPixels))
    const minY = Math.max(0, Math.floor(centerPixel.y - radiusInPixels))
    const maxY = Math.min(rasterData.height - 1, Math.ceil(centerPixel.y + radiusInPixels))

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - centerPixel.x
        const dy = y - centerPixel.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance <= radiusInPixels) {
          const value = getPixelValue(rasterData, x, y)
          if (value !== null && !isNaN(value)) {
            values.push(value)
          }
        }
      }
    }

    if (values.length === 0) {
      if (window._debugLogged <= 3) {
        logger.warn("rasterProcessing", `     [BUFFER ${window._debugLogged}] No pixel values found in ${radiusInPixels}px radius around [${centerPixel.x}, ${centerPixel.y}]`)
      }
      return null
    }

    values.sort((a, b) => a - b)
    const median = values.length % 2 === 0
      ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
      : values[Math.floor(values.length / 2)]

    return median
  } catch (error) {
    logger.error("rasterProcessing", 'Error extracting value at buffer:', error)
    return null
  }
}

export function extractValuesInPolygon(rasterData, polygon, polygonCoords = null) {
  const values = []

  if (!polygon || !polygon.geometry || !polygon.geometry.coordinates) {
    logger.error("rasterProcessing", '❌ extractValuesInPolygon: Invalid polygon structure!')
    return values
  }

  // Use provided polygon coordinates (may be transformed to raster CRS) or extract from GeoJSON
  const coordsToUse = polygonCoords || polygon.geometry.coordinates[0]

  logger.debug("rasterProcessing", 'extractValuesInPolygon: Starting extraction')
  logger.debug("rasterProcessing", '  Polygon vertices count:', coordsToUse.length)
  logger.debug("rasterProcessing", '  First 3 vertices:', coordsToUse.slice(0, 3).map(p => `[${p[0].toFixed(1)}, ${p[1].toFixed(1)}]`).join(', '))

  const bounds = polygonCoords
    ? { minLon: Math.min(...polygonCoords.map(p => p[0])), maxLon: Math.max(...polygonCoords.map(p => p[0])), minLat: Math.min(...polygonCoords.map(p => p[1])), maxLat: Math.max(...polygonCoords.map(p => p[1])) }
    : getPolygonBounds(polygon)

  logger.debug("rasterProcessing", '  Polygon bounds (lon/lat):', bounds)
  logger.debug("rasterProcessing", '  Bounds size: Δlon=' + (bounds.maxLon - bounds.minLon).toFixed(6) + ', Δlat=' + (bounds.maxLat - bounds.minLat).toFixed(6))
  logger.debug("rasterProcessing", '  Raster CRS:', rasterData.crs, 'size:', rasterData.width, 'x', rasterData.height)
  logger.debug("rasterProcessing", '  Raster geotransform:', rasterData.geotransform)
  logger.debug("rasterProcessing", '  Raster origin (geotransform[0], geotransform[3]):', [rasterData.geotransform[0], rasterData.geotransform[3]])
  logger.debug("rasterProcessing", '  Pixel size (geotransform[1], geotransform[5]):', [rasterData.geotransform[1], rasterData.geotransform[5]])

  // Convert polygon corners to pixel coordinates
  let minPixelX = Infinity
  let maxPixelX = -Infinity
  let minPixelY = Infinity
  let maxPixelY = -Infinity
  let successfulCorners = 0

  try {
    // Try all 4 corners of the bounds to get pixel bounds
    const corners = [
      [bounds.minLon, bounds.minLat],
      [bounds.minLon, bounds.maxLat],
      [bounds.maxLon, bounds.minLat],
      [bounds.maxLon, bounds.maxLat]
    ]

    corners.forEach(([lon, lat]) => {
      try {
        const pixel = coordinateToPixel(rasterData, lat, lon)
        if (isFinite(pixel.x) && isFinite(pixel.y)) {
          minPixelX = Math.min(minPixelX, pixel.x)
          maxPixelX = Math.max(maxPixelX, pixel.x)
          minPixelY = Math.min(minPixelY, pixel.y)
          maxPixelY = Math.max(maxPixelY, pixel.y)
          successfulCorners++
        }
      } catch (e) {
        logger.warn("rasterProcessing", `  ⚠️ Failed to convert corner [${lon}, ${lat}]: ${e.message}`)
      }
    })

    if (successfulCorners === 0) {
      logger.error("rasterProcessing", '  ❌ CRITICAL: Could not convert ANY polygon corners to pixels!')
      logger.error("rasterProcessing", '     Polygon bounds:', bounds)
      logger.error("rasterProcessing", '     Raster CRS:', rasterData.crs)
      return values
    }

    // Clamp to raster bounds
    minPixelX = Math.max(0, Math.floor(minPixelX))
    maxPixelX = Math.min(rasterData.width - 1, Math.ceil(maxPixelX))
    minPixelY = Math.max(0, Math.floor(minPixelY))
    maxPixelY = Math.min(rasterData.height - 1, Math.ceil(maxPixelY))

    // Ensure at least 1 pixel range (for sub-pixel polygons)
    if (minPixelX === maxPixelX) maxPixelX = Math.min(minPixelX + 1, rasterData.width - 1)
    if (minPixelY === maxPixelY) maxPixelY = Math.min(minPixelY + 1, rasterData.height - 1)

    logger.debug("rasterProcessing", `  ✓ Converted ${successfulCorners}/4 corners successfully`)
    logger.debug("rasterProcessing", '  Pixel bounds to scan:', { minPixelX, maxPixelX, minPixelY, maxPixelY })
    logger.debug("rasterProcessing", '  Pixel range size:', (maxPixelX - minPixelX + 1) * (maxPixelY - minPixelY + 1), 'pixels')
  } catch (e) {
    logger.error("rasterProcessing", '  ❌ Error converting polygon bounds to pixels:', e.message)
    logger.error("rasterProcessing", e)
    return values
  }

  // Iterate through raster pixels within bounds
  let pixelsChecked = 0
  let pixelsInPolygon = 0
  let debugLogged = false

  for (let y = minPixelY; y <= maxPixelY; y++) {
    for (let x = minPixelX; x <= maxPixelX; x++) {
      pixelsChecked++

      try {
        // If polygon was transformed to raster CRS, pixels should already match that CRS
        // Otherwise, convert pixels to the polygon's CRS for comparison
        let pixelCoord
        if (polygonCoords) {
          // Polygon is in raster's native CRS, so use raw pixel coordinates
          const geotransform = rasterData.geotransform
          const px = geotransform[0] + x * geotransform[1] + y * geotransform[2]
          const py = geotransform[3] + x * geotransform[4] + y * geotransform[5]
          pixelCoord = [px, py]
        } else {
          // Polygon is in WGS84, convert pixel to WGS84
          const coord = pixelToCoordinateLonLat(rasterData, x, y)
          pixelCoord = [coord.lon, coord.lat]
        }

        // Debug: log first few pixel checks
        if (!debugLogged && pixelsChecked <= 3) {
          logger.debug("rasterProcessing", `  🔍 Sample pixel check [${x}, ${y}]: coord=[${pixelCoord[0].toFixed(4)}, ${pixelCoord[1].toFixed(4)}]`)
          debugLogged = true
        }

        if (pointInPolygon(pixelCoord, coordsToUse)) {
          pixelsInPolygon++
          const value = getPixelValue(rasterData, x, y)
          if (value !== null && isFinite(value)) {
            values.push(value)
          }
        }
      } catch (e) {
        logger.warn("rasterProcessing", `  Error processing pixel (${x}, ${y}):`, e.message)
      }
    }
  }

  logger.debug("rasterProcessing", '  Pixels checked:', pixelsChecked)
  logger.debug("rasterProcessing", '  Pixels in polygon:', pixelsInPolygon)
  logger.debug("rasterProcessing", '  Valid values extracted:', values.length)
  if (pixelsChecked > 0 && pixelsInPolygon === 0) {
    logger.error("rasterProcessing", '  ⚠️ WARNING: Checked', pixelsChecked, 'pixels but NONE were in polygon!')
    logger.error("rasterProcessing", '     Polygon bounds:', { minLon: Math.min(...coordsToUse.map(p => p[0])), maxLon: Math.max(...coordsToUse.map(p => p[0])), minLat: Math.min(...coordsToUse.map(p => p[1])), maxLat: Math.max(...coordsToUse.map(p => p[1])) })
  }

  return values
}

export function getPolygonBounds(polygon) {
  try {
    // Handle both GeoJSON {geometry: {coordinates}} and raw polygon {coordinates} formats
    const coords = polygon.geometry?.coordinates?.[0] || polygon.coordinates?.[0]

    if (!coords || !Array.isArray(coords) || coords.length === 0) {
      throw new Error('Invalid polygon coordinates format')
    }

    // Extract lats and lons, handling [lon, lat] order (standard GeoJSON)
    const lats = coords.map(coord => {
      if (Array.isArray(coord) && coord.length >= 2) {
        return coord[1]  // lat is second
      }
      throw new Error('Invalid coordinate format')
    })
    const lons = coords.map(coord => {
      if (Array.isArray(coord) && coord.length >= 2) {
        return coord[0]  // lon is first
      }
      throw new Error('Invalid coordinate format')
    })

    // Validate we have valid numbers
    if (lats.some(lat => !isFinite(lat)) || lons.some(lon => !isFinite(lon))) {
      throw new Error('Coordinates contain non-finite values')
    }

    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons)
    }
  } catch (err) {
    logger.error('rasterProcessing', `❌ Error getting polygon bounds: ${err.message}`)
    logger.error('rasterProcessing', `   Polygon structure: ${JSON.stringify(polygon).substring(0, 100)}...`)
    // Return safe default bounds (won't do anything useful, but won't crash)
    return {
      minLat: -90,
      maxLat: 90,
      minLon: -180,
      maxLon: 180
    }
  }
}

export function calculateHistogram(values, binCount = 20, forcedMin = null, forcedMax = null) {
  if (values.length === 0) {
    return { bins: [], stats: {} }
  }

  const sorted = [...values].sort((a, b) => a - b)
  const dataMin = sorted[0]
  const dataMax = sorted[sorted.length - 1]

  // Use forced range when aligning site histogram to area histogram's bins
  // This ensures bin[i] covers the same value range in both histograms
  const min = forcedMin !== null ? forcedMin : dataMin
  const max = forcedMax !== null ? forcedMax : dataMax
  const range = max - min || 1
  const binWidth = range / binCount

  const bins = Array(binCount).fill(null).map((_, i) => ({
    min: min + i * binWidth,
    max: min + (i + 1) * binWidth,
    count: 0,
    percentage: 0,
    density: 0
  }))

  // Assign values to bins
  values.forEach(value => {
    let binIndex = Math.floor((value - min) / binWidth)
    if (binIndex >= binCount) binIndex = binCount - 1
    if (binIndex < 0) binIndex = 0
    bins[binIndex].count++
  })

  // Calculate percentages and density
  // Density = count / (total_count * bin_width)
  // This ensures integral(density * dx) = 1.0, making distributions comparable
  bins.forEach(bin => {
    bin.percentage = ((bin.count / values.length) * 100).toFixed(1)
    bin.density = binWidth > 0 ? bin.count / (values.length * binWidth) : 0
  })

  // Calculate statistics
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const std = Math.sqrt(values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length)
  const percentiles = calculatePercentiles(sorted)

  return {
    bins,
    stats: {
      count: values.length,
      mean: mean.toFixed(3),
      std: std.toFixed(3),
      // Always use actual data min/max for stats (not forced range)
      // so coverage assessment and display curves remain accurate
      min: dataMin.toFixed(3),
      max: dataMax.toFixed(3),
      median: percentiles.p50,
      p25: percentiles.p25,
      p75: percentiles.p75
    }
  }
}

function calculatePercentiles(sortedValues) {
  const getPercentile = (p) => {
    const index = (p / 100) * (sortedValues.length - 1)
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    const weight = index % 1

    if (lower === upper) {
      return sortedValues[lower].toFixed(3)
    }
    return (sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight).toFixed(3)
  }

  return {
    p25: getPercentile(25),
    p50: getPercentile(50),
    p75: getPercentile(75)
  }
}

function metersToPixels(rasterData, meters) {
  // Import CRS detection function
  const crs = determineCRS(rasterData.geotransform, rasterData.crs || 'EPSG:4326')

  // For projected coordinate systems (UTM, etc), pixel size is in meters
  if (crs !== 'EPSG:4326') {
    // Get pixel size from geotransform
    // geotransform[1] is the x-pixel size, geotransform[5] is the y-pixel size (negative)
    const pixelSizeMeters = Math.abs(rasterData.geotransform[1])
    const pixelsRadius = meters / pixelSizeMeters
    return pixelsRadius
  }

  // For geographic coordinate systems (lat/lon), pixel size is in degrees
  // Approximate conversion: 1 degree ≈ 111,320 meters at equator
  const degreesPerMeter = 1 / 111320
  const degreesRadius = meters * degreesPerMeter
  const pixelsPerDegree = rasterData.width / (rasterData.bounds.east - rasterData.bounds.west)
  return degreesRadius * pixelsPerDegree
}

// Point-in-polygon using ray casting algorithm
export function pointInPolygon(point, polygon) {
  const [lon, lat] = point
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]

    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }

  return inside
}
