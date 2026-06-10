import { useState, useEffect, useRef } from 'react'
import localforage from 'localforage'
import logger from '../utils/logger'
import RasterHistogram from './RasterHistogram'
import RasterStack from './RasterStack'
import RasterMetadataDisplay from './RasterMetadataDisplay'
import MeasurementPlanner from './MeasurementPlanner'
import ErrorBoundary from './ErrorBoundary'
import { useNotificationContext } from '../context/NotificationContext'
import { UploadTransaction, checkStorageSpace, validateRasterData } from '../utils/uploadManager'
import {
  parseGeoTIFF,
  extractValueAtBuffer,
  extractValuesInPolygon,
  calculateHistogram,
  getPolygonBounds,
  pointInPolygon
} from '../utils/rasterProcessing'
import {
  calculateCoverageAssessment,
  validatePolygon
} from '../utils/spatialOperations'
import { parseShapefileZip } from '../utils/shapefileHandler'
import { transformCoordinates } from '../utils/coordinateTransform'
import { deleteRasterData, initDB } from '../utils/indexedDBManager'

const CATEGORIES = {
  moisture: { label: 'Moisture', color: '#2196F3', order: 0 },
  vegetation: { label: 'Vegetation', color: '#4CAF50', order: 1 },
  disturbance: { label: 'Disturbance', color: '#FF9800', order: 2 },
  other: { label: 'Other', color: '#9C27B0', order: 3, customizable: true }
}

export default function HeterogeneityAnalysis({ allEntries }) {
  // Notification system
  const { showError, showSuccess, showWarning } = useNotificationContext()

  // State for category-based raster management
  const [rastersByCategory, setRastersByCategory] = useState({})
  const [categorySettings, setCategorySettings] = useState({
    moisture: { enabled: true, customName: null },
    vegetation: { enabled: true, customName: null },
    disturbance: { enabled: true, customName: null },
    other: { enabled: false, customName: 'Other' }
  })
  // Independent state for histogram/analysis layer selection
  const [analysisLayerSelection, setAnalysisLayerSelection] = useState({
    moisture: true,
    vegetation: true,
    disturbance: true,
    other: true
  })
  const [rgbRaster, setRgbRaster] = useState(null) // RGB base layer
  const [rgbDataCache, setRgbDataCache] = useState(null)
  const [polygon, setPolygon] = useState(null)
  const [analysisResults, setAnalysisResults] = useState({}) // {[category]: result}
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [rasterDataCache, setRasterDataCache] = useState({}) // {[category]: rasterData}
  const [analysisTabs, setAnalysisTabs] = useState('heterogeneity') // 'heterogeneity' or 'planning'
  const [candidatePoints, setCandidatePoints] = useState([])
  const fileInputRef = useRef({}) // {[category]: ref}
  const rgbFileInputRef = useRef(null)

  // Load saved state from localStorage
  const loadSavedData = async () => {
    try {
      const saved = await localforage.getItem('rastersByCategory')
      const settings = await localforage.getItem('categorySettings')
      const savedPolygon = await localforage.getItem('studyPolygon')
      const savedResults = await localforage.getItem('rasterAnalysisResults')
      const savedLayerSelection = await localforage.getItem('analysisLayerSelection')
      const savedRgb = await localforage.getItem('rgbRaster')

      if (saved) setRastersByCategory(saved)
      if (settings) setCategorySettings(settings)
      if (savedPolygon) setPolygon(savedPolygon)
      if (savedResults) setAnalysisResults(savedResults)
      if (savedLayerSelection) setAnalysisLayerSelection(savedLayerSelection)
      if (savedRgb) {
        setRgbRaster(savedRgb)
        await loadRgbRaster(savedRgb)
      }
    } catch (err) {
      logger.error('HeterogeneityAnalysis.jsx', 'Error loading saved data:', err)
    }
  }

  // Initialize on mount
  useEffect(() => {
    initDB().catch(err => logger.warn('HeterogeneityAnalysis.jsx', 'IndexedDB init failed, will use localStorage:', err))
    loadSavedData()
  }, [])

  // FIX: Track which categories have been loaded to prevent infinite loop
  const loadedCategories = useRef(new Set())
  // Flag to prevent auto-loading during upload (avoid circular state updates)
  const isUploadingRef = useRef(false)

  // Load all saved category rasters into cache after rastersByCategory is populated
  useEffect(() => {
    const loadAllSavedRasters = async () => {
      // Skip loading if an upload is in progress (prevents circular state updates)
      if (isUploadingRef.current) {
        logger.debug('HeterogeneityAnalysis.jsx', '📂 loadAllSavedRasters: Upload in progress, skipping auto-load')
        return
      }

      const savedCategories = Object.keys(rastersByCategory)
      if (savedCategories.length === 0) {
        logger.debug('HeterogeneityAnalysis.jsx', '📂 loadAllSavedRasters: No saved categories, skipping')
        return
      }

      logger.debug('HeterogeneityAnalysis.jsx', `📂 Loading saved category rasters into cache. Saved categories: [${savedCategories.join(', ')}]`)
      logger.debug('HeterogeneityAnalysis.jsx', `📂 BEFORE loading - rasterDataCache keys: [${Object.keys(rasterDataCache).join(', ')}]`)

      // Identify which categories need loading (not yet attempted)
      const categoriesToLoad = savedCategories.filter(
        category => !loadedCategories.current.has(category)
      )

      if (categoriesToLoad.length === 0) {
        logger.debug('HeterogeneityAnalysis.jsx', '  ✓ All saved categories have been loaded previously')
        return
      }

      logger.debug('HeterogeneityAnalysis.jsx', `  Categories to load now: [${categoriesToLoad.join(', ')}]`)

      // Load each category sequentially
      for (const category of categoriesToLoad) {
        loadedCategories.current.add(category) // Mark as being loaded
        logger.debug('HeterogeneityAnalysis.jsx', `  → Loading ${category}...`)

        try {
          const loaded = await loadCategoryRaster(category)
          if (loaded) {
            logger.debug('HeterogeneityAnalysis.jsx', `  ✓ Successfully loaded ${category} into cache (returned data object)`)
            logger.debug('HeterogeneityAnalysis.jsx', `    Loaded object keys:`, Object.keys(loaded))
          } else {
            logger.warn('HeterogeneityAnalysis.jsx', `  ⚠️ ${category} data not found in storage`)
          }
        } catch (err) {
          logger.error('HeterogeneityAnalysis.jsx', `  ❌ Failed to load ${category}:`, err.message)
        }
      }

      logger.debug('HeterogeneityAnalysis.jsx', `✅ loadAllSavedRasters completed (state update scheduled). Immediate rasterDataCache keys: [${Object.keys(rasterDataCache).join(', ')}]`)
    }

    loadAllSavedRasters()
  }, [rastersByCategory]) // Only depends on rastersByCategory, NOT rasterDataCache!

  // Track rasterDataCache state changes
  useEffect(() => {
    const keys = Object.keys(rasterDataCache)
    logger.debug('HeterogeneityAnalysis.jsx', `📊 rasterDataCache updated - Keys: [${keys.join(', ')}]`)
    keys.forEach(key => {
      if (rasterDataCache[key]) {
        logger.debug('HeterogeneityAnalysis.jsx', `   ${key}: width=${rasterDataCache[key].width}, height=${rasterDataCache[key].height}, pixelsLength=${rasterDataCache[key].pixels?.length || 0}`)
      }
    })
  }, [rasterDataCache])

  // Load field sites
  const [localSites, setLocalSites] = useState([])
  useEffect(() => {
    const loadSites = async () => {
      try {
        const sites = await localforage.getItem('allEntries')
        if (sites) {
          setLocalSites(sites)
          logger.debug('HeterogeneityAnalysis.jsx', '📍 Loaded sites from storage:', sites.length)
        }
      } catch (err) {
        logger.error('HeterogeneityAnalysis.jsx', 'Error loading sites:', err)
      }
    }
    loadSites()
  }, [])

  const sitesData = allEntries.length > 0 ? allEntries : localSites
  useEffect(() => {
    logger.debug('HeterogeneityAnalysis.jsx', '📍 Total sites available:', sitesData.length)
  }, [sitesData])

  // Save layer selection when it changes
  useEffect(() => {
    localforage.setItem('analysisLayerSelection', analysisLayerSelection).catch(err =>
      logger.error('HeterogeneityAnalysis.jsx', 'Error saving layer selection:', err)
    )
  }, [analysisLayerSelection])

  // Load specific category's raster data - returns the loaded data directly
  const loadCategoryRaster = async (category) => {
    try {
      logger.debug('HeterogeneityAnalysis.jsx', `📂 Attempting to load ${category} raster data...`)

      // Load from localStorage (same way as RGB)
      const stored = await localforage.getItem(`rasterData_${category}`)

      logger.debug('HeterogeneityAnalysis.jsx', `  localStorage lookup:`, {
        key: `rasterData_${category}`,
        found: !!stored,
        hasWidth: !!stored?.width,
        hasHeight: !!stored?.height,
        pixelsType: stored?.pixels?.constructor?.name || 'none',
        pixelsLength: stored?.pixels?.length || 0
      })

      if (stored) {
        // Validate stored data structure
        if (!stored.width || !stored.height || !stored.pixels) {
          logger.error('HeterogeneityAnalysis.jsx', `❌ ${category} raster data is incomplete:`, {
            hasWidth: !!stored.width,
            hasHeight: !!stored.height,
            hasPixels: !!stored.pixels,
            pixelsType: stored.pixels?.constructor?.name || 'undefined'
          })
          return null
        }

        const pixelsPerPixel = stored.pixels.length / (stored.width * stored.height)
        logger.debug('HeterogeneityAnalysis.jsx', `✅ Successfully loaded ${category} raster:`, {
          width: stored.width,
          height: stored.height,
          pixelCount: stored.pixels?.length || 0,
          pixelsPerPixel: pixelsPerPixel,
          rasterType: pixelsPerPixel === 3 ? 'RGB' : 'Single-band',
          crs: stored.crs
        })

        // Convert pixels to Float32Array (same as how RGB converts to Uint8ClampedArray)
        let pixelsConverted = null
        try {
          pixelsConverted = new Float32Array(stored.pixels)
          logger.debug('HeterogeneityAnalysis.jsx', `  ✓ Converted pixels to Float32Array: ${pixelsConverted.length} values`)
        } catch (conversionErr) {
          logger.error('HeterogeneityAnalysis.jsx', `❌ Failed to convert pixels to Float32Array:`, conversionErr.message)
          return null
        }

        const rasterData = {
          ...stored,
          pixels: pixelsConverted
        }

        logger.debug('HeterogeneityAnalysis.jsx', `  Setting rasterDataCache[${category}]...`)
        logger.debug('HeterogeneityAnalysis.jsx', `  BEFORE state update - rasterDataCache keys:`, Object.keys(rasterDataCache))

        // Update state AND return the data
        setRasterDataCache(prev => {
          const updated = {
            ...prev,
            [category]: rasterData
          }
          logger.debug('HeterogeneityAnalysis.jsx', `  ✅ rasterDataCache[${category}] set in state updater, total keys:`, Object.keys(updated))
          return updated
        })

        logger.debug('HeterogeneityAnalysis.jsx', `  AFTER setRasterDataCache called - returning rasterData for ${category}`)

        return rasterData // RETURN the data directly!
      } else {
        logger.error('HeterogeneityAnalysis.jsx', `❌ ${category} raster not found in storage. Available keys:`, {
          attempted: `rasterData_${category}`
        })
        return null
      }
    } catch (err) {
      logger.error('HeterogeneityAnalysis.jsx', `❌ Error loading ${category} raster:`, err)
      logger.error('HeterogeneityAnalysis.jsx', 'Full error:', err.stack)
      return null
    }
  }

  // Load RGB raster data
  const loadRgbRaster = async () => {
    try {
      logger.debug('HeterogeneityAnalysis.jsx', `🎨 Loading RGB raster...`)
      let stored = await localforage.getItem('rgbData')

      if (stored) {
        // Validate stored data structure
        if (!stored.width || !stored.height || !stored.pixels) {
          logger.error('HeterogeneityAnalysis.jsx', `❌ RGB raster data is incomplete:`, {
            hasWidth: !!stored.width,
            hasHeight: !!stored.height,
            hasPixels: !!stored.pixels
          })
          return
        }

        logger.debug('HeterogeneityAnalysis.jsx', `✅ RGB raster loaded:`, {
          width: stored.width,
          height: stored.height,
          crs: stored.crs,
          pixelsLength: stored.pixels?.length || 0
        })
        logger.debug('HeterogeneityAnalysis.jsx', `  BEFORE RGB state update - rgbDataCache:`, !!rgbDataCache)

        // Convert pixels to Uint8ClampedArray
        let pixelsConverted = null
        try {
          pixelsConverted = new Uint8ClampedArray(stored.pixels)
          logger.debug('HeterogeneityAnalysis.jsx', `  ✓ Converted RGB pixels to Uint8ClampedArray: ${pixelsConverted.length} values`)
        } catch (conversionErr) {
          logger.error('HeterogeneityAnalysis.jsx', `❌ Failed to convert RGB pixels to Uint8ClampedArray:`, conversionErr.message)
          return
        }

        setRgbDataCache({
          ...stored,
          pixels: pixelsConverted
        })
        logger.debug('HeterogeneityAnalysis.jsx', `  AFTER RGB setRgbDataCache called`)
      } else {
        logger.error('HeterogeneityAnalysis.jsx', `❌ RGB raster not found`)
      }
    } catch (err) {
      logger.error('HeterogeneityAnalysis.jsx', `❌ Error loading RGB raster:`, err)
    }
  }

  // Handle RGB file upload (with transaction safety and rollback)
  const handleRgbUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Prevent auto-loading during upload to avoid circular state updates
    isUploadingRef.current = true

    const fileSizeMB = file.size / (1024 * 1024)

    // Validation checks (BEFORE setting loading)
    if (fileSizeMB > 500) {
      showError(`File too large: ${fileSizeMB.toFixed(1)}MB (max 500MB)`)
      return
    }

    if (fileSizeMB > 50) {
      if (!window.confirm(`Large file (${fileSizeMB.toFixed(1)}MB). This may take time. Continue?`)) return
    }

    setLoading(true)

    try {
      // CRITICAL: Check storage quota before attempting upload
      const hasSpace = await checkStorageSpace(file.size * 2) // 2x for safety margin
      if (!hasSpace) {
        showError('Not enough storage space for RGB raster. Please free up some space and try again.')
        setLoading(false)
        return
      }

      // Create transaction for atomic upload
      const transaction = new UploadTransaction('rgb')
      let rasterData

      // Add steps to transaction
      transaction
        .addStep('Parse GeoTIFF', async () => {
          const targetCRS = localStorage.getItem('rasterTargetCRS') || 'EPSG:4326'
          rasterData = await parseGeoTIFF(file, targetCRS)

          if (!rasterData || !rasterData.width || !rasterData.height) {
            throw new Error('Invalid GeoTIFF: missing width/height')
          }

          return { rasterData }
        })
        .addStep('Validate raster data', async () => {
          const { isValid, errors } = validateRasterData(rasterData)
          if (!isValid) {
            throw new Error(`Validation failed: ${errors.join(', ')}`)
          }
          return { rasterData }
        })
        .addStep('Create metadata', async () => {
          const rgbInfo = {
            fileName: file.name,
            crs: rasterData.crs || 'EPSG:4326',
            bounds: rasterData.bounds,
            uploadedAt: new Date().toISOString(),
            metadata: rasterData.metadata  // Include original CRS and other metadata
          }
          return { rgbInfo, rasterData }
        })
        .addStep('Save metadata', async (result) => {
          await localforage.setItem('rgbRaster', result.rgbInfo)
          return result
        })
        .addStep('Save raster data', async (result) => {
          const rgbDataToStore = {
            width: result.rasterData.width,
            height: result.rasterData.height,
            pixels: Array.from(result.rasterData.pixels),
            geotransform: result.rasterData.geotransform,
            bounds: result.rasterData.bounds,
            crs: result.rasterData.crs
          }
          await localforage.setItem('rgbData', rgbDataToStore)
          return result
        })
        .addStep('Load into cache', async (result) => {
          await loadRgbRaster(result.rgbInfo)
          await new Promise(r => setTimeout(r, 100))
          return result
        })
        .addStep('Update React state', async (result) => {
          setRgbRaster(result.rgbInfo)
          return result
        })

      // Execute transaction with automatic rollback on failure
      await transaction.execute()
      showSuccess(`✅ RGB background raster uploaded successfully!`)

    } catch (err) {
      showError(`RGB upload failed: ${err.message}`)
      logger.error('HeterogeneityAnalysis.jsx', `❌ RGB upload error:`, err)
    } finally {
      // Re-enable auto-loading after upload completes
      isUploadingRef.current = false
      setLoading(false)
      if (rgbFileInputRef.current) {
        rgbFileInputRef.current.value = ''
      }
    }
  }

  // Delete RGB raster
  const deleteRgbRaster = async () => {
    if (!rgbRaster) return
    if (!window.confirm(`Delete ${rgbRaster.fileName}?`)) return

    try {
      await localforage.removeItem('rgbRaster')
      await localforage.removeItem('rgbData')
      setRgbRaster(null)
      setRgbDataCache(null)
      logger.debug('HeterogeneityAnalysis.jsx', `✅ RGB raster deleted`)
    } catch (err) {
      logger.error('HeterogeneityAnalysis.jsx', `❌ Error deleting RGB raster:`, err)
    }
  }

  // Web Worker for polygon analysis
  const extractValuesInPolygonAsync = async (rasterData, polygon, transformedPolygonCoords = null) => {
    return new Promise((resolve, reject) => {
      if (!window.Worker) {
        resolve(extractValuesInPolygon(rasterData, polygon, transformedPolygonCoords))
        return
      }

      try {
        const worker = new Worker(new URL('../utils/extractValuesWorker.js', import.meta.url))
        // Use transformed coordinates if provided, otherwise use original WGS84 from GeoJSON
        const polygonCoords = transformedPolygonCoords || polygon.geometry.coordinates[0]
        const bounds = transformedPolygonCoords
          ? { minLon: Math.min(...transformedPolygonCoords.map(p => p[0])), maxLon: Math.max(...transformedPolygonCoords.map(p => p[0])), minLat: Math.min(...transformedPolygonCoords.map(p => p[1])), maxLat: Math.max(...transformedPolygonCoords.map(p => p[1])) }
          : getPolygonBounds(polygon)

        const { width, height, geotransform } = rasterData

        logger.debug('HeterogeneityAnalysis.jsx', `   📍 Raster geotransform:`, geotransform)
        logger.debug('HeterogeneityAnalysis.jsx', `   📍 Raster origin [X, Y]:`, [geotransform[0], geotransform[3]])
        logger.debug('HeterogeneityAnalysis.jsx', `   📍 Pixel size [ΔX, ΔY]:`, [geotransform[1], geotransform[5]])
        logger.debug('HeterogeneityAnalysis.jsx', `   📍 Polygon bounds [minLon, maxLon, minLat, maxLat]:`, [bounds.minLon.toFixed(4), bounds.maxLon.toFixed(4), bounds.minLat.toFixed(4), bounds.maxLat.toFixed(4)])
        let minPixelX = Infinity, maxPixelX = -Infinity
        let minPixelY = Infinity, maxPixelY = -Infinity

        const corners = [
          [bounds.minLon, bounds.minLat],
          [bounds.minLon, bounds.maxLat],
          [bounds.maxLon, bounds.minLat],
          [bounds.maxLon, bounds.maxLat]
        ]

        logger.debug('HeterogeneityAnalysis.jsx', `   🔬 Converting polygon bounds to pixels:`)
        logger.debug('HeterogeneityAnalysis.jsx', `      Geotransform origin: [${geotransform[0].toFixed(4)}, ${geotransform[3].toFixed(4)}]`)
        logger.debug('HeterogeneityAnalysis.jsx', `      Geotransform scale: [${geotransform[1].toFixed(6)}, ${geotransform[5].toFixed(6)}]`)

        corners.forEach(([lon, lat], idx) => {
          const a = geotransform[1], b = geotransform[2], c = geotransform[0]
          const d = geotransform[4], e = geotransform[5], f = geotransform[3]
          const det = a * e - b * d

          if (Math.abs(det) > 1e-10) {
            const pixelX = ((lon - c) * e - (lat - f) * b) / det
            const pixelY = ((lat - f) * a - (lon - c) * d) / det

            if (idx === 0) {
              logger.debug('HeterogeneityAnalysis.jsx', `      Corner [${lon.toFixed(4)}, ${lat.toFixed(4)}] → pixel [${pixelX.toFixed(1)}, ${pixelY.toFixed(1)}]`)
            }

            minPixelX = Math.min(minPixelX, pixelX)
            maxPixelX = Math.max(maxPixelX, pixelX)
            minPixelY = Math.min(minPixelY, pixelY)
            maxPixelY = Math.max(maxPixelY, pixelY)
          }
        })

        minPixelX = Math.max(0, Math.floor(minPixelX))
        maxPixelX = Math.min(width - 1, Math.ceil(maxPixelX))
        minPixelY = Math.max(0, Math.floor(minPixelY))
        maxPixelY = Math.min(height - 1, Math.ceil(maxPixelY))

        // Ensure at least 1 pixel range (for sub-pixel polygons)
        if (minPixelX === maxPixelX && minPixelX < width - 1) maxPixelX = minPixelX + 1
        if (minPixelY === maxPixelY && minPixelY < height - 1) maxPixelY = minPixelY + 1

        // Expand bounds significantly to catch edge cases (polygon might be outside calculated bounds)
        minPixelX = Math.max(0, minPixelX - 10)
        maxPixelX = Math.min(width - 1, maxPixelX + 10)
        minPixelY = Math.max(0, minPixelY - 10)
        maxPixelY = Math.min(height - 1, maxPixelY + 10)

        const expandedSize = (maxPixelX - minPixelX + 1) * (maxPixelY - minPixelY + 1)
        const totalSize = width * height

        logger.debug('HeterogeneityAnalysis.jsx', `  Pixel bounds (expanded): X[${minPixelX}-${maxPixelX}] Y[${minPixelY}-${maxPixelY}] (size: ${expandedSize} of ${totalSize} pixels)`)

        // Only fall back to full-raster scan for truly sub-pixel polygons (≤10 pixels).
        // Never expand to the full raster just because the polygon is small relative
        // to the raster — that would include pixels outside the polygon bbox, and even
        // though pointInPolygon would still exclude them, it wastes time and could
        // produce unexpected results if the polygon transform is slightly off.
        if ((maxPixelX - minPixelX + 1) * (maxPixelY - minPixelY + 1) <= 4) {
          logger.warn('HeterogeneityAnalysis.jsx', `  ⚠️ Sub-pixel polygon — scanning entire raster (will still filter by polygon)`)
          minPixelX = 0
          maxPixelX = width - 1
          minPixelY = 0
          maxPixelY = height - 1
        }

        logger.debug('HeterogeneityAnalysis.jsx', `  📦 Sending to worker: X[${minPixelX}-${maxPixelX}] Y[${minPixelY}-${maxPixelY}]`)

        worker.onmessage = (event) => {
          const { type, values } = event.data
          if (type === 'complete') {
            worker.terminate()
            resolve(values)
          }
        }

        worker.onerror = (error) => {
          logger.error('HeterogeneityAnalysis.jsx', 'Worker error:', error)
          worker.terminate()
          reject(error)
        }

        worker.postMessage({
          pixels: rasterData.pixels,
          width, height, geotransform, polygonCoords,
          minPixelX, maxPixelX, minPixelY, maxPixelY
        })
      } catch (err) {
        logger.error('HeterogeneityAnalysis.jsx', 'Fallback to main thread:', err)
        // Must pass transformedPolygonCoords here too — without it, UTM rasters would
        // compare WGS84 degrees vs UTM metres in the point-in-polygon check (wrong).
        resolve(extractValuesInPolygon(rasterData, polygon, transformedPolygonCoords))
      }
    })
  }

  // Upload raster for specific category (with transaction safety and rollback)
  const handleCategoryFileUpload = async (e, category) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Prevent auto-loading during upload to avoid circular state updates
    isUploadingRef.current = true

    const fileSizeMB = file.size / (1024 * 1024)

    // Validation checks
    if (fileSizeMB > 500) {
      showError(`File too large: ${fileSizeMB.toFixed(1)}MB (max 500MB)`)
      return
    }

    if (fileSizeMB > 50) {
      if (!window.confirm(`Large file (${fileSizeMB.toFixed(1)}MB). This may take time. Continue?`)) return
    }

    setLoading(true)

    try {
      // CRITICAL: Check storage quota before attempting upload
      const hasSpace = await checkStorageSpace(file.size * 2) // 2x for safety margin
      if (!hasSpace) {
        showError('Not enough storage space. Please free up some space and try again.')
        setLoading(false)
        return
      }

      // Clear old data for this category
      try {
        await deleteRasterData(category)
        await localforage.removeItem(`rasterData_${category}`)
        setRasterDataCache(prev => {
          const updated = { ...prev }
          delete updated[category]
          return updated
        })
      } catch (err) {
        logger.warn('HeterogeneityAnalysis.jsx', `⚠️ Could not clear old ${category} data:`, err.message)
      }

      // Create transaction for atomic upload
      const transaction = new UploadTransaction(category)
      let rasterData

      // Add steps to transaction
      transaction
        .addStep('Parse GeoTIFF', async () => {
          const targetCRS = localStorage.getItem('rasterTargetCRS') || 'EPSG:4326'
          rasterData = await parseGeoTIFF(file, targetCRS)

          if (!rasterData || !rasterData.width || !rasterData.height) {
            throw new Error('Invalid GeoTIFF: missing width/height')
          }

          return { rasterData }
        })
        .addStep('Validate raster data', async () => {
          const { isValid, errors } = validateRasterData(rasterData)
          if (!isValid) {
            throw new Error(`Validation failed: ${errors.join(', ')}`)
          }
          return { rasterData }
        })
        .addStep('Create metadata', async () => {
          // Extract pixel dimensions from geotransform: [originX, pixelWidth, 0, originY, 0, pixelHeight]
          const pixelWidth = Math.abs(rasterData.geotransform[1])
          const pixelHeight = Math.abs(rasterData.geotransform[5])

          const rasterInfo = {
            category,
            fileName: file.name,
            crs: rasterData.crs || 'EPSG:4326',
            bounds: rasterData.bounds,
            pixelWidth,
            pixelHeight,
            uploadedAt: new Date().toISOString(),
            metadata: rasterData.metadata  // Include original CRS and other metadata
          }
          logger.debug('HeterogeneityAnalysis.jsx', `📝 Created metadata for ${category}:`, {
            fileName: rasterInfo.fileName,
            crs: rasterInfo.crs,
            pixelWidth,
            pixelHeight,
            hasMetadata: !!rasterInfo.metadata
          })
          return { rasterInfo, rasterData }
        })
        .addStep('Save metadata', async (result) => {
          const newRasters = { ...rastersByCategory, [category]: result.rasterInfo }
          logger.debug('HeterogeneityAnalysis.jsx', `💾 Saving metadata for ${category}...`)
          await localforage.setItem('rastersByCategory', newRasters)
          setRastersByCategory(newRasters)
          logger.debug('HeterogeneityAnalysis.jsx', `✅ Metadata saved and state updated for ${category}`)
          return result
        })
        .addStep('Save raster data', async (result) => {
          const rasterDataToStore = {
            width: result.rasterData.width,
            height: result.rasterData.height,
            pixels: Array.from(result.rasterData.pixels),
            geotransform: result.rasterData.geotransform,
            bounds: result.rasterData.bounds,
            crs: result.rasterData.crs,
            metadata: result.rasterData.metadata
          }

          logger.debug('HeterogeneityAnalysis.jsx', `💾 Saving ${category} raster data to localStorage:`, {
            width: rasterDataToStore.width,
            height: rasterDataToStore.height,
            pixelsLength: rasterDataToStore.pixels.length,
            pixelsPerPixel: rasterDataToStore.pixels.length / (rasterDataToStore.width * rasterDataToStore.height),
            key: `rasterData_${category}`
          })

          // Store same way as RGB - directly in localStorage
          await localforage.setItem(`rasterData_${category}`, rasterDataToStore)

          // Verify it was saved
          const verify = await localforage.getItem(`rasterData_${category}`)
          logger.debug('HeterogeneityAnalysis.jsx', `✅ Verified save for ${category}:`, {
            saved: !!verify,
            pixelsLength: verify?.pixels?.length || 0
          })

          return result
        })
        .addStep('Load into cache', async (result) => {
          logger.debug('HeterogeneityAnalysis.jsx', `⏳ Loading ${category} into cache...`)
          const loaded = await loadCategoryRaster(category)
          logger.debug('HeterogeneityAnalysis.jsx', `${loaded ? '✅' : '❌'} Load into cache completed for ${category}`)
          await new Promise(r => setTimeout(r, 100))
          return result
        })
        .addStep('Enable category', async (result) => {
          if (!categorySettings[category]?.enabled) {
            setCategorySettings(prev => ({
              ...prev,
              [category]: { ...prev[category], enabled: true }
            }))
          }
          return result
        })

      // Execute transaction with automatic rollback on failure
      await transaction.execute()
      showSuccess(`✅ ${category} raster uploaded successfully!`)

    } catch (err) {
      showError(`Upload failed: ${err.message}`)
      logger.error('HeterogeneityAnalysis.jsx', `❌ Upload error:`, err)
    } finally {
      // Re-enable auto-loading after upload completes
      isUploadingRef.current = false
      setLoading(false)
      if (fileInputRef.current[category]) {
        fileInputRef.current[category].value = ''
      }
    }
  }

  // Handle polygon change - triggers analysis for ALL enabled categories
  const handlePolygonChange = async (newPolygon) => {
    if (newPolygon) {
      const validation = validatePolygon(newPolygon)
      if (!validation.valid) {
        setError(validation.error)
        return
      }
      logger.debug('HeterogeneityAnalysis.jsx', '✅ Polygon loaded, vertices:', newPolygon.geometry.coordinates[0].length)
    }

    setPolygon(newPolygon)
    await localforage.setItem('studyPolygon', newPolygon)

    if (newPolygon) {
      const enabledCategories = Object.keys(categorySettings).filter(cat => categorySettings[cat]?.enabled)
      logger.debug('HeterogeneityAnalysis.jsx', '🎯 Enabled categories:', enabledCategories)
      if (enabledCategories.length > 0) {
        await runAnalysisForCategories(enabledCategories, newPolygon)
      } else {
        logger.warn('HeterogeneityAnalysis.jsx', '⚠️ No enabled categories for analysis')
      }
    }
  }

  // Analyze multiple categories
  const runAnalysisForCategories = async (categories, polygonGeom) => {
    if (!polygonGeom) {
      logger.error('HeterogeneityAnalysis.jsx', '❌ No polygon provided!')
      setError('No polygon provided')
      alert('❌ Ошибка: полигон не загружен')
      return
    }

    logger.debug('HeterogeneityAnalysis.jsx', '🔬 Starting analysis for categories:', categories)
    logger.debug('HeterogeneityAnalysis.jsx', '📍 Polygon coords:', polygonGeom.geometry.coordinates[0].length)
    logger.debug('HeterogeneityAnalysis.jsx', '📊 Available rasters:', Object.keys(rastersByCategory))
    logger.debug('HeterogeneityAnalysis.jsx', '📊 Raster data cache keys:', Object.keys(rasterDataCache))
    logger.debug('HeterogeneityAnalysis.jsx', '📍 Total sites available:', sitesData.length)

    if (sitesData.length === 0) {
      const msg = '⚠️ No field sites loaded! Make sure your sites data is imported.'
      logger.warn('HeterogeneityAnalysis.jsx', msg)
      alert(msg)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const newResults = { ...analysisResults }

      logger.debug('HeterogeneityAnalysis.jsx', `\n🟢 ANALYSIS STARTING - Categories to analyze: ${categories.join(', ')}`)
      logger.debug('HeterogeneityAnalysis.jsx', `Available rastersByCategory keys: ${Object.keys(rastersByCategory).join(', ')}`)
      logger.debug('HeterogeneityAnalysis.jsx', `Raster cache keys: ${Object.keys(rasterDataCache).join(', ')}`)

      for (const category of categories) {
        logger.debug('HeterogeneityAnalysis.jsx', `\n${'='.repeat(50)}`)
        logger.debug('HeterogeneityAnalysis.jsx', `🔵 ANALYZING ${category.toUpperCase()}`)
        logger.debug('HeterogeneityAnalysis.jsx', `${'='.repeat(50)}`)
        if (!rastersByCategory[category]) {
          logger.error('HeterogeneityAnalysis.jsx', `❌ No raster metadata for ${category}`)
          alert(`❌ ${category}: Raster metadata not found!`)
          continue
        }

        if (!rasterDataCache[category]) {
          logger.debug('HeterogeneityAnalysis.jsx', `   Loading ${category} raster from storage...`)
        } else {
          logger.debug('HeterogeneityAnalysis.jsx', `   ✓ ${category} raster already in cache`)
        }

        // Load raster if not in cache
        let rasterData = rasterDataCache[category]
        if (!rasterData) {
          logger.debug('HeterogeneityAnalysis.jsx', `Loading ${category} raster from storage...`)
          rasterData = await loadCategoryRaster(category)
        }

        if (!rasterData) {
          logger.error('HeterogeneityAnalysis.jsx', `❌ Failed to load ${category} raster data`)
          alert(`❌ Could not load ${category} raster from storage`)
          continue
        }

        // Detect raster CRS and transform polygon if needed
        let rasterCRS = rasterData.crs || 'EPSG:4326'
        let polygonCoords = polygonGeom.geometry.coordinates[0]

        // FIX: If CRS is 3857 (Web Mercator - wrong for analysis!), use 32634 instead (UTM 34N for Abisko)
        if (rasterCRS === 'EPSG:3857') {
          logger.warn('HeterogeneityAnalysis.jsx', `   ⚠️ Raster has incorrect CRS (Web Mercator 3857), using EPSG:32634 (UTM 34N) instead`)
          rasterCRS = 'EPSG:32634'
        }

        logger.debug('HeterogeneityAnalysis.jsx', `🗺️ Raster CRS (after fix): ${rasterCRS}`)

        // Debug: show all polygon vertices
        logger.debug('HeterogeneityAnalysis.jsx', `   📍 Polygon vertices (${polygonCoords.length} total):`)
        polygonCoords.forEach((pt, idx) => {
          logger.debug('HeterogeneityAnalysis.jsx', `      [${idx}]: [${pt[0].toFixed(4)}, ${pt[1].toFixed(4)}]`)
        })

        // Polygon from shapefile is always in lat/lon (EPSG:4326)
        // If raster is in different CRS, transform polygon coordinates
        if (rasterCRS !== 'EPSG:4326') {
          logger.debug('HeterogeneityAnalysis.jsx', `🔄 Converting polygon from EPSG:4326 to ${rasterCRS}`)
          logger.debug('HeterogeneityAnalysis.jsx', `   Sample polygon point before transform: [${polygonCoords[0][0]}, ${polygonCoords[0][1]}]`)
          try {
            const newCoords = polygonCoords.map(([lon, lat], idx) => {
              if (!isFinite(lon) || !isFinite(lat)) {
                logger.warn('HeterogeneityAnalysis.jsx', `   ⚠️ Invalid coordinate at index ${idx}: [${lon}, ${lat}]`)
                return [lon, lat]
              }
              const transformed = transformCoordinates(lon, lat, 'EPSG:4326', rasterCRS)
              if (!isFinite(transformed.lon) || !isFinite(transformed.lat)) {
                logger.error('HeterogeneityAnalysis.jsx', `   ❌ Transformation produced NaN at index ${idx}: [${lon}, ${lat}] → [${transformed.lon}, ${transformed.lat}]`)
                return [lon, lat]
              }
              return [transformed.lon, transformed.lat]
            })
            polygonCoords = newCoords
            logger.debug('HeterogeneityAnalysis.jsx', `✅ Polygon coordinates transformed to ${rasterCRS}`)
            logger.debug('HeterogeneityAnalysis.jsx', `   Sample polygon point after transform: [${polygonCoords[0][0]}, ${polygonCoords[0][1]}]`)
          } catch (err) {
            logger.error('HeterogeneityAnalysis.jsx', `❌ Polygon transformation error: ${err.message}`)
            logger.error('HeterogeneityAnalysis.jsx', err)
            // Don't proceed with analysis if polygon can't be transformed
            continue
          }
        } else {
          logger.debug('HeterogeneityAnalysis.jsx', `✅ Polygon already in correct CRS (EPSG:4326)`)
        }

        // Extract values at sites
        logger.debug('HeterogeneityAnalysis.jsx', `\n   🔍 Testing ${sitesData.length} sites for ${category}...`)
        logger.debug('HeterogeneityAnalysis.jsx', `   Polygon CRS: ${rasterCRS}, vertices: ${polygonCoords.length}`)
        logger.debug('HeterogeneityAnalysis.jsx', `   Sample polygon coords after transform:`, polygonCoords.slice(0, 2))

        // Test first few sites to debug
        if (polygonCoords.length > 0) {
          const xVals = polygonCoords.map(p => p[0])
          const yVals = polygonCoords.map(p => p[1])
          logger.debug('HeterogeneityAnalysis.jsx', `   Polygon bounds: X[${Math.min(...xVals).toFixed(0)}-${Math.max(...xVals).toFixed(0)}] Y[${Math.min(...yVals).toFixed(0)}-${Math.max(...yVals).toFixed(0)}]`)
        }

        let debugSampleLogged = false
        let testCount = 0
        let inPolygonCount = 0

        const sitesInArea = sitesData.filter((site, siteIdx) => {
          if (!site.latitude || !site.longitude) return false

          testCount++

          // Sites are always in lat/lon - if raster is UTM, need to check differently
          let checkCoords
          if (rasterCRS === 'EPSG:4326') {
            checkCoords = [site.longitude, site.latitude]
          } else {
            const transformed = transformCoordinates(site.longitude, site.latitude, 'EPSG:4326', rasterCRS)
            checkCoords = [transformed.lon, transformed.lat]

            // Log a sample to debug
            if (!debugSampleLogged && siteIdx < 3) {
              logger.debug('HeterogeneityAnalysis.jsx', `   Sample site #${siteIdx + 1}: WGS84[${site.longitude}, ${site.latitude}] → ${rasterCRS}[${checkCoords[0].toFixed(0)}, ${checkCoords[1].toFixed(0)}]`)
              debugSampleLogged = true
            }
          }

          const inPolygon = pointInPolygon(checkCoords, polygonCoords)
          if (inPolygon) inPolygonCount++
          return inPolygon
        })

        logger.debug('HeterogeneityAnalysis.jsx', `   ✓ Tested ${testCount} sites: ${inPolygonCount} inside polygon`)

        logger.debug('HeterogeneityAnalysis.jsx', `   Found ${sitesInArea.length} sites in polygon for ${category}`)
        if (sitesInArea.length === 0) {
          logger.error('HeterogeneityAnalysis.jsx', `   ❌ NO SITES IN POLYGON FOR ${category.toUpperCase()}!`)
          logger.error('HeterogeneityAnalysis.jsx', `   Polygon has ${polygonCoords.length} vertices`)
          if (polygonCoords.length > 0) {
            logger.error('HeterogeneityAnalysis.jsx', `   First vertex: [${polygonCoords[0][0].toFixed(0)}, ${polygonCoords[0][1].toFixed(0)}]`)
            logger.error('HeterogeneityAnalysis.jsx', `   Last vertex: [${polygonCoords[polygonCoords.length-1][0].toFixed(0)}, ${polygonCoords[polygonCoords.length-1][1].toFixed(0)}]`)
          }
          logger.error('HeterogeneityAnalysis.jsx', `   Sample sites tested: ${sitesData.slice(0, 3).map(s => `[${s.longitude}, ${s.latitude}]`).join(', ')}`)
          alert(`❌ ${category}: No sites found in polygon!\n\nPolygon: ${polygonCoords.length} vertices\nSites tested: ${sitesData.length} total`)
          continue
        }

        const siteValues = []
        for (const site of sitesInArea) {
          const value = extractValueAtBuffer(rasterData, site.latitude, site.longitude, site.accuracy || 5)
          if (value !== null) {
            siteValues.push({ value, siteNumber: site.siteNumber })
          }
        }

        logger.debug('HeterogeneityAnalysis.jsx', `   Extracted values from ${siteValues.length} sites`)
        if (siteValues.length === 0) {
          logger.error('HeterogeneityAnalysis.jsx', `   ❌ No valid raster values extracted for ${category}`)
          alert(`❌ ${category}: No valid raster values found at sites!`)
          continue
        }

        // Extract values in polygon
        // Pass the potentially-transformed polygon coordinates to match what was used for site filtering
        logger.debug('HeterogeneityAnalysis.jsx', `   Extracting area pixels for ${category}...`)
        const areaValues = await extractValuesInPolygonAsync(rasterData, polygonGeom, polygonCoords)
        logger.debug('HeterogeneityAnalysis.jsx', `   Extracted ${areaValues.length} area pixels for ${category}`)
        if (areaValues.length === 0) {
          logger.error('HeterogeneityAnalysis.jsx', `   ❌ No pixels in polygon for ${category}`)
          logger.error('HeterogeneityAnalysis.jsx', `   This usually means: polygon coordinates don't overlap with raster, or raster has no data in polygon area`)
          logger.error('HeterogeneityAnalysis.jsx', `   Raster CRS: ${rasterCRS}, Polygon CRS: EPSG:4326`)
          alert(`❌ ${category}: No pixels found in polygon!\n\nRaster CRS: ${rasterCRS}\nNo data values or coordinate mismatch?`)
          continue
        }

        // Filter out NoData values (-9999 and similar fill values)
        const isValidValue = v => isFinite(v) && v > -9000
        const validSiteValues = siteValues.map(s => s.value).filter(isValidValue)
        const validAreaValues = areaValues.filter(isValidValue)

        if (validSiteValues.length === 0) {
          alert(`❌ ${category}: All site values are NoData (-9999). Check raster alignment.`)
          continue
        }

        // Calculate area histogram first to establish the shared value range
        // Then force site histogram to use the same bin boundaries so that
        // bin[i] covers identical value ranges in both — required for correct
        // undersampling detection in findUnsampledRanges (which compares by index)
        const areaHistogram = calculateHistogram(validAreaValues, 20)
        const areaRangeMin = parseFloat(areaHistogram.stats.min)
        const areaRangeMax = parseFloat(areaHistogram.stats.max)
        const siteHistogram = calculateHistogram(validSiteValues, 20, areaRangeMin, areaRangeMax)
        const coverage = calculateCoverageAssessment(siteHistogram.stats, areaHistogram.stats)

        newResults[category] = {
          sitesAnalyzed: sitesInArea.length,
          siteValues,
          areaPixelsCount: areaValues.length,
          siteHistogram,
          areaHistogram,
          coverage,
          analyzedAt: new Date().toISOString()
        }
        logger.debug('HeterogeneityAnalysis.jsx', `✓ Completed analysis for ${category}:`, newResults[category].coverage)
      }

      logger.debug('HeterogeneityAnalysis.jsx', 'Saving results:', newResults)
      await localforage.setItem('rasterAnalysisResults', newResults)
      setAnalysisResults(newResults)

      const completedCount = Object.keys(newResults).length
      const message = `✓ Analysis complete! ${completedCount} category(ies) analyzed. Check histograms below.`
      logger.debug('HeterogeneityAnalysis.jsx', message)
      alert(message)
    } catch (err) {
      const errorMsg = `Analysis failed: ${err.message}`
      setError(errorMsg)
      logger.error('HeterogeneityAnalysis.jsx', 'Analysis error:', err)
      alert(`❌ ${errorMsg}`)
    } finally {
      setLoading(false)
    }
  }

  // Delete raster for category
  const deleteCategoryRaster = async (category) => {
    if (!rastersByCategory[category]) return
    if (!window.confirm(`Delete ${rastersByCategory[category].fileName}?`)) return

    try {
      const newRasters = { ...rastersByCategory }
      delete newRasters[category]

      const newResults = { ...analysisResults }
      delete newResults[category]

      await localforage.setItem('rastersByCategory', newRasters)
      await localforage.removeItem(`rasterData_${category}`)
      await localforage.setItem('rasterAnalysisResults', newResults)
      await deleteRasterData(category).catch(err => logger.warn('HeterogeneityAnalysis.jsx', 'IndexedDB delete failed:', err))

      setRastersByCategory(newRasters)
      setAnalysisResults(newResults)
      setRasterDataCache(prev => {
        const updated = { ...prev }
        delete updated[category]
        return updated
      })

      // Disable this category
      setCategorySettings(prev => ({
        ...prev,
        [category]: { ...prev[category], enabled: false }
      }))
    } catch (err) {
      setError(`Failed to delete raster: ${err.message}`)
    }
  }

  // Upload shapefile for polygon (with transaction safety)
  const handleShapefileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const fileSizeMB = file.size / (1024 * 1024)

    // Validation checks
    if (fileSizeMB > 100) {
      showError(`File too large: ${fileSizeMB.toFixed(1)}MB (max 100MB)`)
      return
    }

    setLoading(true)

    try {
      // CRITICAL: Check storage quota before attempting upload
      const hasSpace = await checkStorageSpace(file.size * 2)
      if (!hasSpace) {
        showError('Not enough storage space for shapefile. Please free up some space and try again.')
        return
      }

      // Create transaction for atomic upload
      const transaction = new UploadTransaction('shapefile')
      let polygon

      // Add steps to transaction
      transaction
        .addStep('Parse shapefile', async () => {
          polygon = await parseShapefileZip(file)

          if (!polygon || !polygon.geometry || !polygon.geometry.coordinates) {
            throw new Error('Invalid shapefile: missing geometry')
          }

          return { polygon }
        })
        .addStep('Validate polygon', async (result) => {
          const validation = validatePolygon(result.polygon)
          if (!validation.valid) {
            throw new Error(`Polygon validation failed: ${validation.error}`)
          }
          return result
        })
        .addStep('Check coordinate system', async (result) => {
          const coords = result.polygon.geometry.coordinates[0]
          const firstLon = coords[0][0]

          if (Math.abs(firstLon) > 1000) {
            logger.warn('HeterogeneityAnalysis.jsx', '⚠️ Shapefile appears to be in projected coordinates. Consider reprojecting to lat/lon.')
            showWarning('Shapefile coordinates appear to be in projected system. Results may be incorrect.')
          }

          return result
        })
        .addStep('Save polygon to storage', async (result) => {
          await localforage.setItem('studyPolygon', result.polygon)
          return result
        })
        .addStep('Update React state and run analysis', async (result) => {
          setPolygon(result.polygon)

          // Trigger analysis for enabled categories
          const enabledCategories = Object.keys(categorySettings).filter(cat => categorySettings[cat]?.enabled)
          if (enabledCategories.length > 0) {
            logger.debug('HeterogeneityAnalysis.jsx', '🎯 Polygon loaded, running analysis for enabled categories...')
            await runAnalysisForCategories(enabledCategories, result.polygon)
          }

          return result
        })

      // Execute transaction with automatic rollback on failure
      await transaction.execute()
      showSuccess(`✅ Shapefile loaded successfully! Polygon has ${polygon.geometry.coordinates[0].length} vertices.`)

    } catch (err) {
      showError(`Shapefile upload failed: ${err.message}`)
      logger.error('HeterogeneityAnalysis.jsx', `❌ Shapefile upload error:`, err)
    } finally {
      setLoading(false)
    }
  }

  // Toggle category analysis
  const toggleCategory = (category) => {
    try {
      logger.debug('HeterogeneityAnalysis.jsx', `☑️ Toggling ${category}...`)
      const newSettings = {
        ...categorySettings,
        [category]: { ...categorySettings[category], enabled: !categorySettings[category]?.enabled }
      }
      setCategorySettings(newSettings)
      localforage.setItem('categorySettings', newSettings).catch(e => logger.warn('HeterogeneityAnalysis.jsx', 'Failed to save settings:', e))
      logger.debug('HeterogeneityAnalysis.jsx', `✅ ${category} now ${newSettings[category]?.enabled ? 'enabled' : 'disabled'}`)
    } catch (err) {
      logger.error('HeterogeneityAnalysis.jsx', `❌ Error toggling ${category}:`, err)
      setError(`Error toggling category: ${err.message}`)
    }
  }

  // Update custom name for Other category
  const updateCategoryName = async (customName) => {
    const newSettings = {
      ...categorySettings,
      other: { ...categorySettings.other, customName: customName || 'Other' }
    }
    setCategorySettings(newSettings)
    await localforage.setItem('categorySettings', newSettings)
  }

  return (
    <ErrorBoundary>
    <div className="heterogeneity-section" style={{ minHeight: 'auto' }}>
      <h3 style={{ marginBottom: '16px', color: 'var(--text-primary)' }}>
        🔬 Multi-Category Raster Analysis
      </h3>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        borderBottom: '2px solid var(--border-color)',
        paddingBottom: '12px'
      }}>
        <button
          onClick={() => setAnalysisTabs('heterogeneity')}
          style={{
            padding: '10px 16px',
            backgroundColor: analysisTabs === 'heterogeneity' ? 'var(--accent-color)' : 'transparent',
            color: analysisTabs === 'heterogeneity' ? 'white' : 'var(--text-primary)',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
        >
          📊 Raster Analysis
        </button>
        <button
          onClick={() => setAnalysisTabs('planning')}
          style={{
            padding: '10px 16px',
            backgroundColor: analysisTabs === 'planning' ? 'var(--accent-color)' : 'transparent',
            color: analysisTabs === 'planning' ? 'white' : 'var(--text-primary)',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
        >
          📍 Plan Next Points
        </button>
      </div>

      {analysisTabs === 'heterogeneity' && (
        <>
      {/* COMPACT Analysis Controls - With Labels */}
      <div style={{
        padding: '12px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '6px',
        marginBottom: '16px',
        border: '1px solid var(--border-color)'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          fontSize: '11px'
        }}>
          {/* 1. Select Variables for Analysis */}
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600' }}>
              1️⃣ VARIABLES TO ANALYZE
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {Object.entries(CATEGORIES).map(([key, cat]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={categorySettings[key]?.enabled || false}
                    onChange={() => toggleCategory(key)}
                    style={{ cursor: 'pointer', width: '14px', height: '14px' }}
                  />
                  <span style={{ color: cat.color, fontWeight: '600', fontSize: '10px' }}>■</span>
                  <span style={{ color: 'var(--text-primary)', fontSize: '10px' }}>
                    {key === 'other' ? (categorySettings.other?.customName || 'Other').substring(0, 5) : cat.label.substring(0, 5)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 2. RGB Background (Optional) */}
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600' }}>
              2️⃣ RGB BACKGROUND (optional)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="file"
                accept=".tif,.tiff"
                onChange={handleRgbUpload}
                disabled={loading}
                ref={rgbFileInputRef}
                style={{ fontSize: '10px', maxWidth: '120px' }}
                title="Satellite/aerial image"
              />
              {rgbRaster && (
                <button
                  onClick={deleteRgbRaster}
                  style={{
                    padding: '2px 6px',
                    backgroundColor: '#ffebee',
                    color: '#c62828',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '10px'
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            {rgbRaster && (
              <div style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                ✓ {rgbRaster.fileName.substring(0, 20)}
              </div>
            )}
          </div>

          {/* 3. Study Polygon */}
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600' }}>
              3️⃣ STUDY AREA (polygon)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="file"
                accept=".zip"
                onChange={handleShapefileUpload}
                disabled={loading}
                style={{ fontSize: '10px', maxWidth: '120px' }}
                title="Shapefile or draw on map"
              />
              {polygon && <span style={{ fontSize: '12px', color: '#4CAF50' }}>✓</span>}
            </div>
            <div style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              or draw on map →
            </div>
          </div>

          {/* 4. Run Analysis (to the right of Study Area) */}
          {polygon && Object.keys(rastersByCategory).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <button
                onClick={async () => {
                  const selectedCategories = Object.keys(categorySettings).filter(cat => categorySettings[cat]?.enabled && rastersByCategory[cat])
                  if (selectedCategories.length === 0) {
                    alert('⚠️ Enable at least one raster category to analyze')
                    return
                  }
                  setLoading(true)
                  setError(null)
                  try {
                    await runAnalysisForCategories(selectedCategories, polygon)
                  } catch (err) {
                    setError(`Analysis failed: ${err.message}`)
                    logger.error('HeterogeneityAnalysis.jsx', 'Analysis error:', err)
                  } finally {
                    setLoading(false)
                  }
                }}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '10px 8px',
                  backgroundColor: loading ? '#FFC107' : '#2196F3',
                  color: loading ? '#000' : 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: loading ? 'wait' : 'pointer',
                  fontSize: '11px',
                  fontWeight: '600'
                }}
              >
                {loading ? '⏳ Analyzing...' : '▶️ Run Analysis'}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div style={{
            gridColumn: '1 / -1',
            padding: '6px',
            backgroundColor: '#ffebee',
            color: '#c62828',
            borderRadius: '4px',
            fontSize: '10px'
          }}>
            {error}
          </div>
        )}
      </div>

      {loading && (
        <div style={{
          padding: '24px',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: '14px'
        }}>
          ⏳ Analyzing...
        </div>
      )}

      {/* COMPACT ANALYSIS RESULTS AT TOP */}
      {Object.values(analysisResults).some(r => r) && (
        <div style={{
          marginBottom: '24px',
          padding: '12px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '8px'
        }}>
          {/* Polygon Status Indicator */}
          {polygon && (
            <div style={{
              padding: '8px 12px',
              backgroundColor: 'rgba(76, 175, 80, 0.1)',
              border: '1px solid #4caf50',
              borderRadius: '4px',
              fontSize: '11px',
              color: '#2e7d32',
              marginBottom: '12px'
            }}>
              ✅ Polygon loaded: {polygon.geometry.coordinates[0].length} vertices
            </div>
          )}

          {/* Compact Histogram Selection - Horizontal */}
          <div style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
            marginBottom: '12px',
            fontSize: '12px',
            flexWrap: 'wrap'
          }}>
            <strong style={{ color: 'var(--text-primary)' }}>Histograms:</strong>
            {Object.entries(CATEGORIES).map(([key, cat]) => {
              if (!rastersByCategory[key]) return null
              const categoryName = key === 'other' ? categorySettings.other?.customName : cat.label
              return (
                <label key={key} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  color: 'var(--text-primary)'
                }}>
                  <input
                    type="checkbox"
                    checked={analysisLayerSelection[key] || false}
                    onChange={(e) => {
                      setAnalysisLayerSelection(prev => ({
                        ...prev,
                        [key]: e.target.checked
                      }))
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ color: cat.color, fontWeight: '600' }}>■</span>
                  {categoryName}
                </label>
              )
            })}
            {polygon && (
              <button
                onClick={async () => {
                  const selectedCategories = Object.entries(CATEGORIES)
                    .filter(([key]) => analysisLayerSelection[key] && rastersByCategory[key])
                    .map(([key]) => key)

                  logger.debug('HeterogeneityAnalysis.jsx', '🔵 Run Analysis clicked. Selected categories:', selectedCategories)

                  if (selectedCategories.length === 0) {
                    alert('⚠️ Please select at least one category with a raster to analyze')
                    return
                  }

                  if (!polygon) {
                    alert('⚠️ Please draw or upload a polygon first')
                    return
                  }

                  setLoading(true)
                  setError(null)
                  try {
                    logger.debug('HeterogeneityAnalysis.jsx', '🟢 Starting analysis...')
                    await runAnalysisForCategories(selectedCategories, polygon)
                    logger.debug('HeterogeneityAnalysis.jsx', '🟢 Analysis complete!')
                  } catch (err) {
                    logger.error('HeterogeneityAnalysis.jsx', '🔴 Analysis error:', err)
                    setError(`Analysis failed: ${err.message}`)
                  } finally {
                    setLoading(false)
                  }
                }}
                disabled={loading || !polygon}
                style={{
                  padding: '6px 12px',
                  backgroundColor: loading ? '#FFC107' : '#2196F3',
                  color: loading ? '#000' : 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'wait' : (polygon ? 'pointer' : 'not-allowed'),
                  fontSize: '12px',
                  fontWeight: '600',
                  opacity: loading || !polygon ? 0.7 : 1,
                  transition: 'all 0.2s'
                }}
              >
                {loading ? '⏳ Analyzing... (check console)' : '▶️ Run Analysis'}
              </button>
            )}
          </div>

          {/* Debug: Show analysis results state */}
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Analysis results: {Object.keys(analysisResults).length} categories
            {' | '}
            Selected: {Object.entries(analysisLayerSelection).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none'}
          </div>

          {/* Selected Layer Histograms - Compact Grid */}
          {Object.entries(CATEGORIES)
            .filter(([key]) => analysisLayerSelection[key] && rastersByCategory[key])
            .length > 0 ? (
            <>
              {(() => {
                // Count visible histograms with results
                const visibleCount = Object.entries(CATEGORIES)
                  .filter(([key]) => analysisLayerSelection[key] && analysisResults[key])
                  .length
                const columnCount = Math.min(window.innerWidth < 600 ? 1 : 2, visibleCount || 1)

                return (
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                gap: '12px',
                marginBottom: '12px'
              }}>
                {Object.entries(CATEGORIES).map(([key, cat]) => {
                  if (!analysisLayerSelection[key]) {
                    console.debug(`Skipping ${key}: not selected`)
                    return null
                  }

                  // Check if raster exists but no analysis results
                  if (!rastersByCategory[key]) {
                    console.debug(`Skipping ${key}: no raster`)
                    return null
                  }

                  // Show message if analysis not run yet
                  if (!analysisResults[key]) {
                    console.debug(`Showing "not run" message for ${key}`)
                    return (
                      <div key={key} style={{
                        padding: '8px',
                        backgroundColor: 'rgba(33, 150, 243, 0.05)',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                        textAlign: 'center'
                      }}>
                        <div style={{ color: cat.color, fontWeight: '600', marginBottom: '4px' }}>
                          {key === 'other' ? categorySettings.other?.customName : cat.label}
                        </div>
                        <div>Draw polygon → Click Run Analysis</div>
                      </div>
                    )
                  }

                  const categoryName = key === 'other' ? categorySettings.other?.customName : cat.label
                  const result = analysisResults[key]

                  logger.debug('HeterogeneityAnalysis.jsx', `Rendering histogram for ${key}:`, result)

                  return (
                    <div key={key} style={{ minWidth: 0 }}>
                      <h5 style={{
                        margin: '0 0 4px 0',
                        color: cat.color,
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        {categoryName}
                      </h5>
                      {result.siteHistogram && result.areaHistogram ? (
                        <RasterHistogram
                          siteStats={result.siteHistogram}
                          areaStats={result.areaHistogram}
                          coverage={result.coverage}
                          columnCount={columnCount}
                        />
                      ) : (
                        <div style={{
                          padding: '8px',
                          backgroundColor: 'rgba(244, 67, 54, 0.05)',
                          borderRadius: '4px',
                          fontSize: '10px',
                          color: '#d32f2f',
                          textAlign: 'center'
                        }}>
                          ⚠️ No sites in polygon or no histograms
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
                )
              })()}
            </>
          ) : Object.entries(CATEGORIES).some(([key]) => analysisLayerSelection[key] && rastersByCategory[key]) ? (
            <div style={{
              padding: '8px',
              backgroundColor: 'rgba(33, 150, 243, 0.05)',
              borderRadius: '4px',
              fontSize: '11px',
              color: 'var(--text-secondary)'
            }}>
              ⏳ Draw polygon on map to run analysis
            </div>
          ) : null}
        </div>
      )}

      {/* Raster Stack - Vertical Layout with Toggleable Layers */}
      {analysisTabs === 'heterogeneity' && (Object.keys(rastersByCategory).length > 0 || rgbDataCache) && (
        <RasterStack
          rgbRaster={rgbRaster}
          rgbDataCache={rgbDataCache}
          rastersByCategory={rastersByCategory}
          rasterDataCache={rasterDataCache}
          categorySettings={categorySettings}
          polygon={polygon}
          onPolygonChange={handlePolygonChange}
          allEntries={sitesData}
          candidatePoints={candidatePoints}
        />
      )}

      {/* Category Upload Cards Grid - Compact Section */}
      <div style={{
        marginTop: '24px',
        padding: '16px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '8px',
        marginBottom: '24px'
      }}>
        <h3 style={{ margin: '0 0 12px 0', color: 'var(--text-primary)', fontSize: '14px' }}>
          📁 Upload Rasters by Category
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '12px'
        }}>
        {Object.entries(CATEGORIES).map(([key, cat]) => {
          const rasterInfo = rastersByCategory[key]
          const categoryName = key === 'other' ? categorySettings.other?.customName : cat.label

          return (
            <div
              key={key}
              style={{
                padding: '12px',
                backgroundColor: 'var(--bg-primary)',
                borderRadius: '6px',
                border: `1px solid ${cat.color}`,
                textAlign: 'center'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px', fontSize: '12px' }}>
                <span style={{ color: cat.color, fontWeight: '600' }}>■</span>
                {key === 'other' ? (
                  <input
                    type="text"
                    value={categorySettings.other?.customName || 'Other'}
                    onChange={(e) => updateCategoryName(e.target.value)}
                    style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: 'var(--text-primary)',
                      border: '1px solid #ddd',
                      padding: '2px 4px',
                      borderRadius: '3px',
                      flex: 1
                    }}
                  />
                ) : (
                  <strong style={{ color: 'var(--text-primary)' }}>{categoryName}</strong>
                )}
              </div>

              {!rasterInfo ? (
                <>
                  <input
                    type="file"
                    accept=".tif,.tiff"
                    onChange={(e) => handleCategoryFileUpload(e, key)}
                    disabled={loading}
                    ref={(ref) => { fileInputRef.current[key] = ref }}
                    style={{ display: 'none' }}
                  />
                  <button
                    onClick={() => fileInputRef.current[key]?.click()}
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '6px',
                      backgroundColor: cat.color,
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}
                  >
                    📁 Upload
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {rasterInfo.fileName}
                  </div>
                  <button
                    onClick={() => deleteCategoryRaster(key)}
                    style={{
                      width: '100%',
                      padding: '4px',
                      backgroundColor: '#ffebee',
                      color: '#c62828',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '10px'
                    }}
                  >
                    🗑️ Delete
                  </button>
                </>
              )}
            </div>
          )
        })}
        </div>
      </div>

        {/* Show raster metadata and CRS information - at the very bottom */}
        <RasterMetadataDisplay rastersByCategory={rastersByCategory} categorySettings={categorySettings} />
        </>
      )}

      {analysisTabs === 'planning' && (
        <MeasurementPlanner
          rastersByCategory={rastersByCategory}
          rasterDataCache={rasterDataCache}
          rgbDataCache={rgbDataCache}
          histogramsByCategory={analysisResults}
          polygon={polygon}
          sitesData={sitesData}
          analysisTabs={analysisTabs}
          onCandidatePointsGenerated={(points) => {
            setCandidatePoints(points)
            logger.debug('HeterogeneityAnalysis.jsx', `Received ${points.length} candidate points`)
          }}
        />
      )}
    </div>
    </ErrorBoundary>
  )
}
