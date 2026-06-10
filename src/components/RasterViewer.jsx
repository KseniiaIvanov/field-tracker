import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react'
import logger from '../utils/logger'
import { pixelToCoordinateLonLat, determineCRS, transformCoordinates } from '../utils/coordinateTransform'
import { coordinateToPixel } from '../utils/rasterProcessing'
import { rafDebounce } from '../utils/performanceUtils'

// Viridis color map (0-1 normalized)
const VIRIDIS = [
  [0.267004, 0.004874, 0.329415],
  [0.282623, 0.140461, 0.469470],
  [0.253935, 0.265254, 0.529983],
  [0.206756, 0.371758, 0.553806],
  [0.163625, 0.471133, 0.558395],
  [0.127568, 0.566949, 0.550809],
  [0.134692, 0.658636, 0.517649],
  [0.266941, 0.748751, 0.440573],
  [0.477504, 0.821444, 0.318195],
  [0.741388, 0.873449, 0.149561],
  [0.993248, 0.906157, 0.143936]
]

// RdYlBu color map (Red-Yellow-Blue, 0-1 normalized) - Red to Blue
const RDYLBU = [
  [0.836, 0.188, 0.153],   // Dark red
  [0.957, 0.427, 0.263],   // Red-orange
  [0.992, 0.682, 0.38],    // Orange
  [0.996, 0.878, 0.565],   // Yellow-orange
  [0.996, 0.996, 0.749],   // Light yellow
  [0.878, 0.953, 0.878],   // Pale yellow-white
  [0.718, 0.882, 0.918],   // Light blue
  [0.408, 0.761, 0.894],   // Sky blue
  [0.145, 0.573, 0.851],   // Blue
  [0.039, 0.412, 0.745]    // Dark blue
]

// Plasma color map (Purple-Pink-Yellow)
const PLASMA = [
  [0.050383, 0.029803, 0.529975],
  [0.301705, 0.028663, 0.659338],
  [0.551231, 0.110824, 0.675675],
  [0.768365, 0.280672, 0.569184],
  [0.941162, 0.512920, 0.388031],
  [0.986433, 0.749504, 0.230689],
  [0.940015, 0.975158, 0.131326]
]

// Inferno color map (Black-Red-Yellow)
const INFERNO = [
  [0.001462, 0.000466, 0.013866],
  [0.186161, 0.029227, 0.382539],
  [0.481196, 0.099702, 0.404343],
  [0.756277, 0.281528, 0.277619],
  [0.940596, 0.593529, 0.164525],
  [0.988362, 0.998364, 0.644924]
]

// Grayscale color map (Black to White)
const GRAYSCALE = [
  [0.0, 0.0, 0.0],
  [0.25, 0.25, 0.25],
  [0.5, 0.5, 0.5],
  [0.75, 0.75, 0.75],
  [1.0, 1.0, 1.0]
]

// Copper color map (Dark to Bright Copper)
const COPPER = [
  [0.0, 0.0, 0.0],
  [0.50, 0.31, 0.0],
  [1.0, 0.65, 0.33],
  [1.0, 0.94, 0.87]
]

// Blues color map (Light to Dark Blue) — good for moisture
const BLUES = [
  [0.969, 0.984, 1.0],
  [0.871, 0.922, 0.969],
  [0.776, 0.859, 0.937],
  [0.620, 0.792, 0.882],
  [0.420, 0.682, 0.839],
  [0.259, 0.573, 0.776],
  [0.129, 0.443, 0.710],
  [0.031, 0.318, 0.612],
  [0.031, 0.188, 0.420]
]

// Greens color map (Light to Dark Green) — good for vegetation
const GREENS = [
  [0.969, 0.988, 0.961],
  [0.898, 0.961, 0.878],
  [0.780, 0.914, 0.753],
  [0.631, 0.851, 0.608],
  [0.455, 0.769, 0.463],
  [0.255, 0.671, 0.365],
  [0.137, 0.545, 0.271],
  [0.0, 0.427, 0.173],
  [0.0, 0.267, 0.106]
]

// Reds color map (Light to Dark Red) — good for disturbance
const REDS = [
  [1.0, 0.961, 0.941],
  [0.996, 0.878, 0.824],
  [0.988, 0.733, 0.631],
  [0.988, 0.573, 0.447],
  [0.984, 0.416, 0.290],
  [0.937, 0.231, 0.173],
  [0.796, 0.094, 0.114],
  [0.647, 0.059, 0.082],
  [0.404, 0.0, 0.051]
]

function getColormapByName(name) {
  switch (name) {
    case 'plasma': return PLASMA
    case 'inferno': return INFERNO
    case 'grayscale': return GRAYSCALE
    case 'copper': return COPPER
    case 'rdylbu': return RDYLBU
    case 'blues': return BLUES
    case 'greens': return GREENS
    case 'reds': return REDS
    case 'viridis':
    default: return VIRIDIS
  }
}

function getColorForValue(value, colormap = VIRIDIS) {
  const idx = Math.min(colormap.length - 1, Math.max(0, Math.floor(value * (colormap.length - 1))))
  return colormap[idx]
}

function RasterViewerComponent({
  rasterData,
  polygon,
  onPolygonChange,
  sites,
  candidatePoints = [],
  colormap = 'viridis',
  readOnly = false,
  opacity = 1,
  // Synchronized zoom/pan from parent (for multi-layer view)
  zoom: externalZoom = null,
  onZoomChange = null
}) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [polygonCoords, setPolygonCoords] = useState([])
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })
  const [selectedColormap, setSelectedColormap] = useState(colormap)
  const [, setRasterStats] = useState(null)
  const [showRasterCRS, setShowRasterCRS] = useState(false)
  const [rasterCRS, setRasterCRS] = useState('EPSG:4326')
  const [localZoom, setLocalZoom] = useState(1)
  const [isRGBRaster, setIsRGBRaster] = useState(false)

  // Use external zoom if provided (multi-layer), otherwise use local
  const zoom = externalZoom !== null ? externalZoom : localZoom
  const handleZoomLocal = (direction) => {
    const newZoom = direction === 'in' ? zoom * 1.2 : zoom / 1.2
    const clamped = Math.max(0.5, Math.min(5, newZoom))
    if (onZoomChange) {
      onZoomChange(clamped)
    } else {
      setLocalZoom(clamped)
    }
  }


  // Debug: log when using external zoom/pan
  if (externalZoom !== null || onZoomChange) {
    logger.debug("RasterViewer", `📊 RasterViewer using external zoom=${zoom}, externalZoom=${externalZoom}`)
  }

  // Sync external polygon prop with local state
  useEffect(() => {
    if (polygon && polygon.geometry && polygon.geometry.coordinates) {
      logger.debug("RasterViewer", '📍 RasterViewer: Polygon prop received, setting coordinates:', polygon.geometry.coordinates[0].length, 'points')
      // Convert [lon, lat] arrays to {lat, lon} objects for rendering
      const coordsAsObjects = polygon.geometry.coordinates[0].map(([lon, lat]) => ({
        lat: parseFloat(lat),
        lon: parseFloat(lon)
      }))
      setPolygonCoords(coordsAsObjects)
    }
  }, [polygon])


  // Debounced pan update for smooth dragging
  const debouncedSetPanStart = useMemo(
    () => rafDebounce((coords) => {
      setPanStart(coords)
    }),
    []
  )

  // Auto-fit zoom to show all sites
  useEffect(() => {
    if (!sites || sites.length === 0 || !rasterData) return

    // Calculate bounds of all sites
    let minLat = Infinity, maxLat = -Infinity
    let minLon = Infinity, maxLon = -Infinity

    sites.forEach(site => {
      const lat = parseFloat(site.latitude)
      const lon = parseFloat(site.longitude)
      if (isFinite(lat) && isFinite(lon)) {
        minLat = Math.min(minLat, lat)
        maxLat = Math.max(maxLat, lat)
        minLon = Math.min(minLon, lon)
        maxLon = Math.max(maxLon, lon)
      }
    })

    if (isFinite(minLat) && isFinite(maxLat) && isFinite(minLon) && isFinite(maxLon)) {
      const bounds = rasterData.bounds
      if (bounds) {
        // Calculate what portion of the raster the sites occupy
        const sitesWidth = maxLon - minLon || 0.001
        const sitesHeight = maxLat - minLat || 0.001
        const rasterWidth = bounds.east - bounds.west
        const rasterHeight = bounds.north - bounds.south

        // Calculate zoom to fit sites with 10% padding
        const zoomX = (rasterWidth / sitesWidth) * 0.8
        const zoomY = (rasterHeight / sitesHeight) * 0.8
        const fitZoom = Math.min(zoomX, zoomY, 5) // Cap at 5x zoom
        const newZoom = Math.max(fitZoom, 0.5)

        if (externalZoom === null) {
          setLocalZoom(newZoom)
        }

        logger.debug("RasterViewer", `🎯 Auto-fit zoom: ${newZoom.toFixed(2)}x (sites span ${sitesWidth.toFixed(4)}° × ${sitesHeight.toFixed(4)}°)`)
      }
    }
  }, [sites, rasterData, externalZoom])

  // Draw raster on canvas
  useEffect(() => {
    if (!canvasRef.current || !rasterData) return

    // Detect raster's native CRS
    const detectedCRS = determineCRS(rasterData.geotransform, rasterData.crs || 'EPSG:4326')
    setRasterCRS(detectedCRS)

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Create image from raster pixels
    const { width, height, pixels } = rasterData
    const imageData = ctx.createImageData(width, height)
    const data = imageData.data

    // Detect if this is an RGB image (3 channels)
    const pixelsPerPixel = pixels.length / (width * height)
    const isRGB = pixelsPerPixel === 3
    setIsRGBRaster(isRGB)

    logger.debug("RasterViewer", `🎨 Raster type: ${isRGB ? 'RGB (3 channels)' : 'Grayscale/Single-band'}, pixels per pixel: ${pixelsPerPixel}`)

    if (isRGB) {
      // RGB raster: use pixel values directly as R, G, B
      for (let i = 0; i < pixels.length; i += 3) {
        const r = Math.max(0, Math.min(255, pixels[i]))        // R channel
        const g = Math.max(0, Math.min(255, pixels[i + 1]))    // G channel
        const b = Math.max(0, Math.min(255, pixels[i + 2]))    // B channel

        const pixelIdx = (i / 3) * 4
        data[pixelIdx] = r       // R
        data[pixelIdx + 1] = g   // G
        data[pixelIdx + 2] = b   // B
        data[pixelIdx + 3] = 255 // A (fully opaque)
      }

      setRasterStats({
        validPixels: width * height,
        totalPixels: width * height,
        min: 0,
        max: 255,
        range: 255
      })
    } else {
      // Single-band raster: apply colormap
      // Common no-data sentinel values in geospatial data
      const NO_DATA_VALUES = new Set([-9999, -32768, -32767, 0])

      // Find min/max for normalization (exclude NaN/Infinity/no-data)
      let min = Infinity, max = -Infinity
      let validCount = 0
      for (let i = 0; i < pixels.length; i++) {
        const val = pixels[i]
        if (isFinite(val) && !NO_DATA_VALUES.has(val)) {
          if (val < min) min = val
          if (val > max) max = val
          validCount++
        }
      }

      // Handle case where all values are NaN
      if (!isFinite(min) || !isFinite(max)) {
        min = 0
        max = 1
      }

      // Handle case where min == max (all same value)
      let range = max - min
      if (range < 0.0001) {
        // All values are essentially the same - use a small range for contrast
        min = max - 0.5
        range = 1
      }

      logger.debug("RasterViewer", `Raster stats: ${validCount}/${pixels.length} valid pixels, min=${min.toFixed(3)}, max=${max.toFixed(3)}, range=${range.toFixed(3)}`)

      // Store stats for display
      setRasterStats({
        validPixels: validCount,
        totalPixels: pixels.length,
        min: parseFloat(min.toFixed(4)),
        max: parseFloat(max.toFixed(4)),
        range: parseFloat(range.toFixed(4))
      })

      // Map pixel values to colors using colormap
      const colormap = getColormapByName(selectedColormap)

      // For limited range data, use percentile-based contrast enhancement
      let contrastMin = min
      let contrastMax = max
      if (range < 0.1 && validCount > 0) {
        // Calculate 2nd and 98th percentiles for contrast stretching (excluding no-data)
        const validPixels = []
        for (let i = 0; i < pixels.length; i++) {
          const val = pixels[i]
          if (isFinite(val) && !NO_DATA_VALUES.has(val)) {
            validPixels.push(val)
          }
        }
        if (validPixels.length > 0) {
          validPixels.sort((a, b) => a - b)
          const p2 = validPixels[Math.max(0, Math.floor(validPixels.length * 0.02))]
          const p98 = validPixels[Math.min(validPixels.length - 1, Math.ceil(validPixels.length * 0.98))]
          if (p98 - p2 > 0.00001) {
            contrastMin = p2
            contrastMax = p98
          }
        }
      }
      const contrastRange = contrastMax - contrastMin || 1

      for (let i = 0; i < pixels.length; i++) {
        const val = pixels[i]
        // Normalize to 0-1, treat NaN/invalid/no-data as transparent
        let normalized = 0
        let alpha = 255
        if (isFinite(val) && !NO_DATA_VALUES.has(val)) {
          normalized = (val - contrastMin) / contrastRange
          normalized = Math.max(0, Math.min(1, normalized)) // Clamp to 0-1
        } else {
          alpha = 0 // Make NaN/no-data pixels transparent
        }

        const [r, g, b] = getColorForValue(normalized, colormap)
        const idx = i * 4
        data[idx] = r * 255      // R
        data[idx + 1] = g * 255  // G
        data[idx + 2] = b * 255  // B
        data[idx + 3] = alpha    // A
      }
    }

    // Draw to canvas with opacity
    canvas.width = width
    canvas.height = height
    ctx.globalAlpha = opacity
    ctx.putImageData(imageData, 0, 0)
    ctx.globalAlpha = 1 // Reset for subsequent draws

    // Prepare candidate points data (will draw at the very end, on top)
    const candidatePointsData = []
    if (candidatePoints && candidatePoints.length > 0) {
      let candidatesDrawn = 0
      let candidatesOutOfBounds = 0
      let candidatesError = 0

      logger.debug("RasterViewer", `🎯 Processing ${candidatePoints.length} candidate points for drawing`)

      candidatePoints.forEach((point) => {
        try {
          const lat = parseFloat(point.lat)
          const lon = parseFloat(point.lon)
          if (!isFinite(lat) || !isFinite(lon)) {
            candidatesError++
            return
          }

          // Convert candidate coordinates to pixel coordinates
          let pixelPos
          try {
            pixelPos = coordinateToPixel(rasterData, lat, lon)
          } catch (transformErr) {
            // FALLBACK: Use bounds-based scaling
            try {
              const bounds = rasterData.bounds
              if (bounds && bounds.west !== bounds.east && bounds.north !== bounds.south) {
                const pixelX = ((lon - bounds.west) / (bounds.east - bounds.west)) * width
                const pixelY = ((bounds.north - lat) / (bounds.north - bounds.south)) * height

                if (isFinite(pixelX) && isFinite(pixelY)) {
                  pixelPos = { x: pixelX, y: pixelY }
                } else {
                  throw new Error('Fallback positioning produced NaN', { cause: transformErr })
                }
              } else {
                throw new Error('Bounds are degenerate or invalid', { cause: transformErr })
              }
            } catch {
              candidatesError++
              return
            }
          }

          if (!isFinite(pixelPos.x) || !isFinite(pixelPos.y)) {
            candidatesError++
            return
          }

          if (pixelPos.x < 0 || pixelPos.x >= width || pixelPos.y < 0 || pixelPos.y >= height) {
            candidatesOutOfBounds++
            return
          }

          candidatesDrawn++
          candidatePointsData.push({ pixelPos, point })
        } catch {
          candidatesError++
        }
      })

      if (candidatesDrawn > 0) {
        logger.debug("RasterViewer", `  Candidates prepared: ${candidatesDrawn}/${candidatePoints.length} (${candidatesOutOfBounds} out of bounds, ${candidatesError} errors)`)
      }
    }

    // Draw site markers on top of raster
    if (sites && sites.length > 0) {
      let sitesDrawn = 0
      let sitesOutOfBounds = 0
      let sitesError = 0
      const coordinateTransformErrors = []

      // Log raster metadata for debugging
      logger.debug("RasterViewer", `📍 RASTER METADATA:`)
      logger.debug("RasterViewer", `   CRS: ${rasterData.crs}`)
      logger.debug("RasterViewer", `   Size: ${width} × ${height} pixels`)
      logger.debug("RasterViewer", `   Bounds: W=${rasterData.bounds?.west?.toFixed(4)}, E=${rasterData.bounds?.east?.toFixed(4)}, N=${rasterData.bounds?.north?.toFixed(4)}, S=${rasterData.bounds?.south?.toFixed(4)}`)

      // CRITICAL: Check if bounds are in projected coordinates but CRS says WGS84
      const boundsInProjected = rasterData.bounds?.west > 180 || rasterData.bounds?.west < -180
      const crsIsGeographic = rasterData.crs?.includes('4326')
      if (boundsInProjected && crsIsGeographic) {
        logger.error("RasterViewer", `❌ CRITICAL MISMATCH: CRS=${rasterData.crs} but bounds are in PROJECTED coordinates!`)
        logger.error("RasterViewer", `   This means raster metadata was transformed incorrectly`)
        logger.error("RasterViewer", `   Sites (WGS84 degrees) cannot align with raster (UTM meters)`)
        logger.error("RasterViewer", `   Solution: Raster file may need to be re-processed with GDAL`)
      }

      logger.debug("RasterViewer", `   Bounds type: ${boundsInProjected ? 'PROJECTED (meters/UTM)' : 'GEOGRAPHIC (degrees/WGS84)'}`)
      logger.debug("RasterViewer", `   Geotransform: [${rasterData.geotransform.map((v, i) => {
        if (v === undefined || v === null) return 'undefined'
        return i === 0 || i === 3 ? v.toFixed(1) : v.toFixed(6)
      }).join(', ')}]`)

      // Check if geotransform is degenerate (zero pixel scale)
      const det = rasterData.geotransform[1] * rasterData.geotransform[5] - rasterData.geotransform[2] * rasterData.geotransform[4]
      if (Math.abs(det) < 1e-10) {
        logger.warn("RasterViewer", `⚠️ Cannot draw sites: Geotransform is degenerate (det≈0). Pixel scale may be invalid.`)
        logger.warn("RasterViewer", `   Geotransform: [${rasterData.geotransform.map((v, i) => {
          if (v === undefined || v === null) return 'undefined'
          return i === 0 || i === 3 ? v.toFixed(0) : v.toFixed(4)
        }).join(', ')}]`)
      } else {
        logger.debug("RasterViewer", `🎯 Drawing ${sites.length} sites on raster (CRS=${rasterData.crs}, width=${width}, height=${height})`)
        try {
          logger.debug("RasterViewer", `   Sample sites: ${sites.slice(0, 2).map(s => {
            const lon = parseFloat(s.longitude)
            const lat = parseFloat(s.latitude)
            if (!isFinite(lon) || !isFinite(lat)) return '[invalid]'
            return `[${lon.toFixed(4)}, ${lat.toFixed(4)}]`
          }).join(', ')}`)
        } catch {
          logger.debug("RasterViewer", `   Sample sites: (error logging sites)`)
        }
      }

      // Log raster bounds in native CRS for reference
      if (rasterData.crs !== 'EPSG:4326') {
        const boundsInfo = {
          originX: rasterData.geotransform[0],
          originY: rasterData.geotransform[3],
          eastMax: rasterData.geotransform[0] + width * rasterData.geotransform[1],
          northMin: rasterData.geotransform[3] + height * rasterData.geotransform[5]
        }
        logger.debug("RasterViewer", `📍 Raster bounds in ${rasterData.crs}: X[${boundsInfo.originX.toFixed(1)}-${boundsInfo.eastMax.toFixed(1)}], Y[${boundsInfo.northMin.toFixed(1)}-${boundsInfo.originY.toFixed(1)}]`)
      }

      sites.forEach((site, idx) => {
        try {
          const lat = parseFloat(site.latitude)
          const lon = parseFloat(site.longitude)
          if (!isFinite(lat) || !isFinite(lon)) {
            sitesError++
            if (idx < 2) logger.warn("RasterViewer", `  Site ${idx}: Invalid lat/lon [${lat}, ${lon}]`)
            return
          }

          // Convert site coordinates to pixel coordinates
          let pixelPos
          try {
            pixelPos = coordinateToPixel(rasterData, lat, lon)
          } catch (transformErr) {
            // FALLBACK: If coordinate transformation fails (degenerate geotransform),
            // use bounds-based scaling to position sites anyway
            try {
              const bounds = rasterData.bounds
              if (bounds && bounds.west !== bounds.east && bounds.north !== bounds.south) {
                // Calculate pixel position based on bounds scaling
                const pixelX = ((lon - bounds.west) / (bounds.east - bounds.west)) * width
                const pixelY = ((bounds.north - lat) / (bounds.north - bounds.south)) * height

                if (isFinite(pixelX) && isFinite(pixelY)) {
                  pixelPos = { x: pixelX, y: pixelY }
                  if (idx === 0) {
                    logger.warn("RasterViewer", `  ⚠️ Using fallback positioning (coordinate transform failed)`)
                  }
                } else {
                  throw new Error('Fallback positioning produced NaN', { cause: transformErr })
                }
              } else {
                throw new Error('Bounds are degenerate or invalid', { cause: transformErr })
              }
            } catch (fallbackErr) {
              sitesError++
              coordinateTransformErrors.push(fallbackErr.message)
              if (idx === 0) {
                logger.warn("RasterViewer", `  ⚠️ Cannot position sites: ${fallbackErr.message}`)
              }
              return
            }
          }

          if (!isFinite(pixelPos.x) || !isFinite(pixelPos.y)) {
            sitesError++
            if (idx < 2) logger.warn("RasterViewer", `  Site ${idx}: Transform produced NaN [${pixelPos.x}, ${pixelPos.y}]`)
            return
          }

          if (pixelPos.x < 0 || pixelPos.x >= width || pixelPos.y < 0 || pixelPos.y >= height) {
            sitesOutOfBounds++
            if (idx < 2) { // Log first 2 sites
              let extraInfo = ''
              // For UTM rasters, also show native CRS coordinates
              if (rasterData.crs !== 'EPSG:4326') {
                try {
                  const nativeCRS = transformCoordinates(lon, lat, 'EPSG:4326', rasterData.crs)
                  extraInfo = ` (${rasterData.crs}: [${nativeCRS.lon.toFixed(1)}, ${nativeCRS.lat.toFixed(1)}])`
                } catch {
                  extraInfo = ' (transform failed)'
                }
              }
              logger.warn("RasterViewer", `  Site ${idx} [${lon.toFixed(4)}, ${lat.toFixed(4)}]${extraInfo} → pixel [${pixelPos.x.toFixed(1)}, ${pixelPos.y.toFixed(1)}] OUT OF BOUNDS (raster: 0-${width}, 0-${height})`)
            }
            return // Site outside raster bounds
          }
          sitesDrawn++

          // Draw circle marker
          const radius = 5
          ctx.beginPath()
          ctx.arc(pixelPos.x, pixelPos.y, radius, 0, 2 * Math.PI)

          // Alternate colors: red and white/hollow
          if (idx % 2 === 0) {
            ctx.fillStyle = 'rgba(220, 53, 69, 0.7)' // Red
            ctx.fill()
            ctx.strokeStyle = 'white'
          } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)' // White transparent
            ctx.strokeStyle = 'white'
          }
          ctx.lineWidth = 2
          ctx.stroke()

          // Draw small number in center
          ctx.fillStyle = 'white'
          ctx.font = 'bold 10px Arial'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText((idx + 1).toString(), pixelPos.x, pixelPos.y)
        } catch (err) {
          // Skip sites that can't be converted
          sitesError++
          if (idx < 2) {
            logger.error("RasterViewer", `  Site ${idx} unexpected error:`, err.message)
          }
        }
      })

      if (sites.length > 0) {
        logger.debug("RasterViewer", `  Sites: ${sitesDrawn}/${sites.length} drawn (${sitesOutOfBounds} out of bounds, ${sitesError} errors)`)
        if (coordinateTransformErrors.length > 0) {
          logger.error("RasterViewer", `  Transform errors: ${coordinateTransformErrors.join('; ')}`)
        }
      }
    }

    // Draw polygon points and lines being drawn
    if (polygonCoords.length > 0) {
      let polygonPointsDrawn = 0
      let polygonPointsOutOfBounds = 0
      const polygonErrors = []

      logger.debug("RasterViewer", `🔷 Drawing polygon with ${polygonCoords.length} points on raster (CRS=${rasterData.crs})`)

      polygonCoords.forEach((coord, idx) => {
        try {
          const lat = parseFloat(coord.lat)
          const lon = parseFloat(coord.lon)
          if (!isFinite(lat) || !isFinite(lon)) {
            if (idx === 0) logger.warn("RasterViewer", `  Polygon point ${idx}: Invalid lat/lon [${lat}, ${lon}]`)
            return
          }

          let pixelPos
          try {
            pixelPos = coordinateToPixel(rasterData, lat, lon)
          } catch (transformErr) {
            // FALLBACK: Use bounds-based scaling if coordinate transform fails
            try {
              const bounds = rasterData.bounds
              if (bounds && bounds.west !== bounds.east && bounds.north !== bounds.south) {
                const pixelX = ((lon - bounds.west) / (bounds.east - bounds.west)) * width
                const pixelY = ((bounds.north - lat) / (bounds.north - bounds.south)) * height
                if (isFinite(pixelX) && isFinite(pixelY)) {
                  pixelPos = { x: pixelX, y: pixelY }
                } else {
                  throw new Error('Fallback produced NaN', { cause: transformErr })
                }
              } else {
                throw new Error('Bounds invalid', { cause: transformErr })
              }
            } catch (fallbackErr) {
              polygonErrors.push(fallbackErr.message)
              if (idx === 0) {
                logger.warn("RasterViewer", `  Polygon point ${idx}: Using fallback positioning`)
              }
              return
            }
          }

          if (!isFinite(pixelPos.x) || !isFinite(pixelPos.y)) {
            if (idx === 0) logger.warn("RasterViewer", `  Polygon point ${idx}: Transform produced NaN [${pixelPos.x}, ${pixelPos.y}]`)
            return
          }

          if (pixelPos.x < 0 || pixelPos.x >= width || pixelPos.y < 0 || pixelPos.y >= height) {
            polygonPointsOutOfBounds++
            if (idx === 0) {
              logger.warn("RasterViewer", `  Polygon point 0 [${lon.toFixed(2)}, ${lat.toFixed(2)}] → pixel [${pixelPos.x}, ${pixelPos.y}] OUT OF BOUNDS`)
            }
            return
          }

          polygonPointsDrawn++
          // Draw point
          const radius = 6
          ctx.beginPath()
          ctx.arc(pixelPos.x, pixelPos.y, radius, 0, 2 * Math.PI)
          ctx.fillStyle = 'rgba(76, 175, 80, 0.8)' // Green
          ctx.fill()
          ctx.strokeStyle = 'white'
          ctx.lineWidth = 2
          ctx.stroke()

          // Draw number
          ctx.fillStyle = 'white'
          ctx.font = 'bold 11px Arial'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText((idx + 1).toString(), pixelPos.x, pixelPos.y)
        } catch (err) {
          console.debug(`Polygon point ${idx} error:`, err.message)
        }
      })

      // Draw polygon lines - BRIGHT YELLOW AND THICK!
      if (polygonCoords.length > 1) {
        // Draw outline first (черный для контраста)
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)'
        ctx.lineWidth = 6
        ctx.setLineDash([])
        ctx.beginPath()

        for (let i = 0; i < polygonCoords.length; i++) {
          try {
            const lat = parseFloat(polygonCoords[i].lat)
            const lon = parseFloat(polygonCoords[i].lon)
            if (!isFinite(lat) || !isFinite(lon)) continue

            let pixelPos
            try {
              pixelPos = coordinateToPixel(rasterData, lat, lon)
            } catch (transformErr) {
              // FALLBACK: Use bounds-based scaling if coordinate transform fails
              try {
                const bounds = rasterData.bounds
                if (bounds && bounds.west !== bounds.east && bounds.north !== bounds.south) {
                  const pixelX = ((lon - bounds.west) / (bounds.east - bounds.west)) * width
                  const pixelY = ((bounds.north - lat) / (bounds.north - bounds.south)) * height
                  if (isFinite(pixelX) && isFinite(pixelY)) {
                    pixelPos = { x: pixelX, y: pixelY }
                  } else {
                    throw new Error('Fallback produced NaN', { cause: transformErr })
                  }
                } else {
                  throw new Error('Bounds invalid', { cause: transformErr })
                }
              } catch {
                if (i === 0) {
                  logger.warn("RasterViewer", `  Polygon outline: Using fallback positioning`)
                }
                continue
              }
            }

            if (i === 0) {
              ctx.moveTo(pixelPos.x, pixelPos.y)
            } else {
              ctx.lineTo(pixelPos.x, pixelPos.y)
            }
          } catch (err) {
            console.debug(`Line drawing error at point ${i}:`, err.message)
          }
        }
        ctx.stroke()

        // Draw bright yellow line on top
        ctx.strokeStyle = '#FFFF00' // Bright yellow
        ctx.lineWidth = 4
        ctx.setLineDash([])
        ctx.beginPath()

        for (let i = 0; i < polygonCoords.length; i++) {
          try {
            const lat = parseFloat(polygonCoords[i].lat)
            const lon = parseFloat(polygonCoords[i].lon)
            if (!isFinite(lat) || !isFinite(lon)) continue

            let pixelPos
            try {
              pixelPos = coordinateToPixel(rasterData, lat, lon)
            } catch (transformErr) {
              // FALLBACK: Use bounds-based scaling if coordinate transform fails
              try {
                const bounds = rasterData.bounds
                if (bounds && bounds.west !== bounds.east && bounds.north !== bounds.south) {
                  const pixelX = ((lon - bounds.west) / (bounds.east - bounds.west)) * width
                  const pixelY = ((bounds.north - lat) / (bounds.north - bounds.south)) * height
                  if (isFinite(pixelX) && isFinite(pixelY)) {
                    pixelPos = { x: pixelX, y: pixelY }
                  } else {
                    throw new Error('Fallback produced NaN', { cause: transformErr })
                  }
                } else {
                  throw new Error('Bounds invalid', { cause: transformErr })
                }
              } catch {
                if (i === 0) {
                  logger.warn("RasterViewer", `  Polygon yellow line: Using fallback positioning`)
                }
                continue
              }
            }

            if (i === 0) {
              ctx.moveTo(pixelPos.x, pixelPos.y)
            } else {
              ctx.lineTo(pixelPos.x, pixelPos.y)
            }
          } catch (err) {
            console.debug(`Line drawing error at point ${i}:`, err.message)
          }
        }
        ctx.stroke()
      }

      if (polygonCoords.length > 0) {
        logger.debug("RasterViewer", `  Polygon: ${polygonPointsDrawn}/${polygonCoords.length} points drawn (${polygonPointsOutOfBounds} out of bounds)`)
        if (polygonErrors.length > 0) {
          logger.error("RasterViewer", `  Polygon errors: ${polygonErrors.join('; ')}`)
        }
      }
    }

    // Draw candidate points LAST (on top of everything)
    if (candidatePointsData.length > 0) {
      logger.debug("RasterViewer", `🎯 Drawing ${candidatePointsData.length} candidate points (on top)`)

      candidatePointsData.forEach(({ pixelPos, point }) => {
        try {
          // Use zoneLevel if available (new weighted system), otherwise use numeric priority (legacy)
          let zoneLevel = point.zoneLevel
          let color

          if (zoneLevel) {
            // New system with weighted priorities
            if (zoneLevel === 'critical') {
              color = '#FF1744' // Red - Critical
            } else if (zoneLevel === 'high') {
              color = '#FF6F00' // Orange - High
            } else if (zoneLevel === 'medium') {
              color = '#FFC400' // Amber - Medium
            } else {
              color = '#76FF03' // Light green - Low
            }
          } else {
            // Legacy system with numeric priority (1-4)
            const priority = point.priority || 1
            if (priority >= 4) {
              color = '#FF1744' // Red - Critical
            } else if (priority >= 3) {
              color = '#FF6F00' // Orange - High
            } else if (priority >= 2) {
              color = '#FFC400' // Amber - Medium
            } else {
              color = '#76FF03' // Light green - Low
            }
          }

          // Draw larger diamond/square shape
          const radius = 12 // Much larger

          // Draw outer glow (white background for visibility)
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
          ctx.beginPath()
          ctx.arc(pixelPos.x, pixelPos.y, radius + 2, 0, 2 * Math.PI)
          ctx.fill()

          // Draw diamond shape
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.moveTo(pixelPos.x, pixelPos.y - radius)           // Top
          ctx.lineTo(pixelPos.x + radius, pixelPos.y)           // Right
          ctx.lineTo(pixelPos.x, pixelPos.y + radius)           // Bottom
          ctx.lineTo(pixelPos.x - radius, pixelPos.y)           // Left
          ctx.closePath()
          ctx.fill()

          // Border
          ctx.strokeStyle = 'white'
          ctx.lineWidth = 2
          ctx.stroke()
        } catch (err) {
          logger.error("RasterViewer", `Error drawing candidate point:`, err.message)
        }
      })
    }

    // Scale canvas for display
    canvas.style.width = '100%'
    canvas.style.height = 'auto'
    setCanvasSize({ width, height })
  }, [rasterData, selectedColormap, sites, polygonCoords, candidatePoints])

  const handleCanvasClick = useCallback((e) => {
    // Skip if panning or readonly mode
    if (isPanning || readOnly) return
    if (!canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Scale to actual raster pixel coordinates (0-indexed)
    const scale = rasterData.width / rect.width
    const pixelX = x * scale
    const pixelY = y * scale

    // Convert pixel coordinates to lat/lon (handles CRS conversion)
    try {
      const coords = pixelToCoordinateLonLat(rasterData, pixelX, pixelY)

      // Debug: check if conversion worked
      logger.debug("RasterViewer", `Click at pixel (${pixelX.toFixed(0)}, ${pixelY.toFixed(0)}) → coords:`, coords)
      logger.debug("RasterViewer", `  lat=${coords.lat.toFixed(4)}, lon=${coords.lon.toFixed(4)}`)

      if (!isFinite(coords.lat) || !isFinite(coords.lon)) {
        logger.error("RasterViewer", 'Invalid coordinates from conversion:', coords)
        alert('Coordinate conversion failed. Check F12 console.')
        return
      }
      if (Math.abs(coords.lat) > 90 || Math.abs(coords.lon) > 180) {
        logger.error("RasterViewer", 'Coordinates out of valid range:', coords)
        logger.error("RasterViewer", 'Detected CRS:', rasterCRS)
        const message = `Invalid coordinates! Got lat=${coords.lat.toFixed(0)}, lon=${coords.lon.toFixed(0)}\n\nLikely causes:\n1. Raster is in UTM/projected coordinates\n2. CRS auto-detection failed\n\nWhat CRS is your raster in? (e.g., EPSG:32634 for UTM34N)`
        alert(message)
        return
      }

      // ALWAYS store polygon in lat/lon (standard format)
      // Only USE raster CRS for display to user
      setPolygonCoords([...polygonCoords, {
        lat: parseFloat(coords.lat.toFixed(4)), // Store in degrees
        lon: parseFloat(coords.lon.toFixed(4))
      }])
    } catch (err) {
      logger.error("RasterViewer", 'Coordinate conversion error:', err)
      alert('Could not convert coordinates. GeoTIFF CRS may not be supported.')
    }
  }, [isPanning, readOnly, rasterData, polygonCoords])

  const handleCanvasDoubleClick = useCallback(() => {
    if (readOnly || polygonCoords.length < 3) {
      if (polygonCoords.length < 3) {
        alert(`Need at least 3 points. Current: ${polygonCoords.length}`)
      }
      return
    }

    // Close the polygon - convert lat/lon to [lon, lat] array format
    let polygonRing = polygonCoords.map(p => [p.lon, p.lat])

    // Ensure ring is closed (first and last points are the same)
    const firstPoint = polygonRing[0]
    const lastPoint = polygonRing[polygonRing.length - 1]

    if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
      polygonRing.push(firstPoint) // Auto-close the ring
    }

    // Create GeoJSON feature
    const polygonFeature = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [polygonRing]
      },
      properties: {}
    }

    logger.debug("RasterViewer", '✅ Polygon closed:', polygonRing.length, 'points')
    onPolygonChange(polygonFeature)
    // DON'T clear - keep polygon visible!
    // setPolygonCoords([]) // Clear for next polygon
  }, [polygonCoords, readOnly, onPolygonChange])

  const handleCanvasMouseDown = useCallback((e) => {
    if (e.button === 2) { // Right-click
      setIsPanning(true)
      setPanStart({ x: e.clientX, y: e.clientY })
    }
  }, [])

  const handleCanvasMouseMove = useCallback((e) => {
    if (isPanning && containerRef.current) {
      const deltaX = e.clientX - panStart.x
      const deltaY = e.clientY - panStart.y

      containerRef.current.scrollLeft -= deltaX
      containerRef.current.scrollTop -= deltaY

      debouncedSetPanStart({ x: e.clientX, y: e.clientY })
    }
  }, [isPanning, panStart, debouncedSetPanStart])

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  const handleZoom = useCallback((direction) => {
    handleZoomLocal(direction)
  }, [zoom, onZoomChange])

  // Handle mouse wheel zoom with debounce for performance
  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const newZoom = e.deltaY > 0 ? zoom / 1.1 : zoom * 1.1
      const clamped = Math.max(0.5, Math.min(5, newZoom))
      if (onZoomChange) {
        onZoomChange(clamped)
      } else {
        setLocalZoom(clamped)
      }
    }
  }, [zoom, onZoomChange])


  const handleFinishPolygon = useCallback(() => {
    if (polygonCoords.length < 3) {
      alert('Need at least 3 points to create a polygon')
      return
    }

    // Create GeoJSON polygon - ensure ring is closed
    const coordinates = polygonCoords.map(p => [parseFloat(p.lon), parseFloat(p.lat)])

    // Check if ring is already closed (first and last points are the same)
    const first = coordinates[0]
    const last = coordinates[coordinates.length - 1]
    const tolerance = 1e-10

    if (Math.abs(first[0] - last[0]) > tolerance || Math.abs(first[1] - last[1]) > tolerance) {
      coordinates.push(coordinates[0]) // Close polygon if not already closed
    }

    const geojson = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates]
      }
    }

    logger.debug("RasterViewer", `✅ Polygon submitted with ${coordinates.length} points (closed ring)`)
    logger.debug("RasterViewer", '📤 onPolygonChange called - parent should receive polygon')
    logger.debug("RasterViewer", '📍 Current polygonCoords in state:', polygonCoords.length, 'points')
    onPolygonChange(geojson)
    // Don't clear polygonCoords - keep them visible! The parent will pass polygon back as prop
    // setPolygonCoords([])
  }, [polygonCoords, onPolygonChange])


  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ marginBottom: '12px' }}>
        <h3 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>
          📊 Raster Viewer & Polygon Tool
        </h3>
        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '12px',
          alignItems: 'center'
        }}>
          <button
            onClick={() => setPolygonCoords([])}
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#000'
            }}
          >
            🔄 Clear Points
          </button>
          {polygonCoords.length >= 3 && (
            <button
              onClick={handleFinishPolygon}
              style={{
                padding: '8px 12px',
                backgroundColor: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600'
              }}
            >
              ✅ Finish Polygon ({polygonCoords.length} points)
            </button>
          )}
          {isRGBRaster ? (
            <div style={{
              padding: '8px 12px',
              backgroundColor: 'rgba(76, 175, 80, 0.1)',
              border: '1px solid #4caf50',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#4caf50',
              fontWeight: '500'
            }}>
              🖼️ RGB Image (True Colors)
            </div>
          ) : (
            <select
              value={selectedColormap}
              onChange={(e) => setSelectedColormap(e.target.value)}
              style={{
                padding: '8px 12px',
                backgroundColor: 'var(--input-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                color: 'var(--text-primary)',
                position: 'relative',
                zIndex: 10
              }}
            >
              <option value="blues">🎨 Blues (Moisture)</option>
              <option value="greens">🎨 Greens (Vegetation)</option>
              <option value="reds">🎨 Reds (Disturbance)</option>
              <option value="viridis">🎨 Viridis (Purple-Green-Yellow)</option>
              <option value="plasma">🎨 Plasma (Purple-Pink-Yellow)</option>
              <option value="inferno">🎨 Inferno (Black-Red-Yellow)</option>
              <option value="rdylbu">🎨 RdYlBu (Red-Yellow-Blue)</option>
              <option value="grayscale">🎨 Grayscale</option>
              <option value="copper">🎨 Copper (Gold)</option>
            </select>
          )}

          {rasterCRS !== 'EPSG:4326' && (
            <button
              onClick={() => setShowRasterCRS(!showRasterCRS)}
              title={`Toggle between lat/lon and ${rasterCRS}`}
              style={{
                padding: '8px 12px',
                backgroundColor: showRasterCRS ? '#2196F3' : 'var(--bg-secondary)',
                color: showRasterCRS ? 'white' : 'var(--text-primary)',
                border: `1px solid ${showRasterCRS ? '#1976D2' : 'var(--border-color)'}`,
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
            >
              📍 {showRasterCRS ? rasterCRS : 'Lat/Lon'}
            </button>
          )}
        </div>
      </div>

      {/* Canvas */}
      {/* Zoom Controls */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '8px',
        alignItems: 'center'
      }}>
        <button
          onClick={() => handleZoom('out')}
          disabled={zoom <= 0.5}
          style={{
            padding: '6px 12px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            cursor: zoom <= 0.5 ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            opacity: zoom <= 0.5 ? 0.5 : 1,
            color: '#000'
          }}
        >
          🔍- Zoom Out
        </button>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', minWidth: '50px' }}>
          {(zoom * 100).toFixed(0)}%
        </span>
        <button
          onClick={() => handleZoom('in')}
          disabled={zoom >= 5}
          style={{
            padding: '6px 12px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            cursor: zoom >= 5 ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            opacity: zoom >= 5 ? 0.5 : 1,
            color: '#000'
          }}
        >
          🔍+ Zoom In
        </button>
        <button
          onClick={() => { if (onZoomChange) { onZoomChange(1) } else { setLocalZoom(1) } }}
          style={{
            padding: '6px 12px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            color: '#000'
          }}
        >
          Fit
        </button>
      </div>

      {/* Canvas Container */}
      <div
        ref={containerRef}
        onContextMenu={(e) => e.preventDefault()}
        onWheel={handleWheel}
        style={{
          border: '2px solid var(--border-color)',
          borderRadius: '8px',
          overflow: 'auto',
          backgroundColor: '#f5f5f5',
          marginBottom: '12px',
          height: '500px',
          cursor: isPanning ? 'grabbing' : 'crosshair'
        }}
      >
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onDoubleClick={handleCanvasDoubleClick}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          style={{
            display: 'block',
            width: canvasSize.width * zoom,
            height: canvasSize.height * zoom,
            imageRendering: zoom > 1 ? 'pixelated' : 'auto'
          }}
        />
      </div>

      {/* Data Statistics */}

    </div>
  )
}

export default memo(RasterViewerComponent)
