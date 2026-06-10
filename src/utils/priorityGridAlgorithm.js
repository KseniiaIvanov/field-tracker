import logger from './logger'
import { pointInPolygon, getPolygonBounds } from './rasterProcessing'
import { getThresholdsForParameter } from '../config/algorithmConfig'

/**
 * Priority Grid Algorithm for optimal measurement point planning
 *
 * Algorithm:
 * 1. Identify undersampled values from histograms (siteStats vs areaStats)
 * 2. Create binary masks for each raster (0=well-sampled, 1=undersampled)
 * 3. Resample all binary masks to common resolution (smallest pixel size)
 * 4. For each pixel in polygon: sum binary masks to get priority score
 * 5. Return candidate points sorted by priority
 */

// Determine which value ranges are undersampled
// Returns detailed info about missing percentage and whether it's in peak ranges
export function findUnsampledRanges(siteStats, areaStats, threshold = 0.5) {
  if (!siteStats?.bins || !areaStats?.bins) {
    return {
      bins: [],
      missingPercent: 0,
      peakMissingPercent: 0
    }
  }

  const unsampledBins = []

  // Calculate total counts for percentage calculation
  const totalAreaCount = areaStats.bins.reduce((sum, bin) => sum + (bin.count || 0), 0)

  // Identify "peak" bins (highest density ranges)
  // Peak = bins in the top 25% by density (highest values, not 75th percentile)
  const densities = areaStats.bins.map(b => b.density || 0)
  const sortedDensities = [...densities].sort((a, b) => b - a)
  // Top 25% means: if 20 bins, take indices 0-4 (the 5 highest values)
  const topQuartileSize = Math.max(1, Math.ceil(sortedDensities.length * 0.25))
  const peakThreshold = sortedDensities[topQuartileSize - 1] || 0

  let underSampledAreaCount = 0
  let underSampledPeakCount = 0
  let totalPeakAreaCount = 0

  // Compare coverage: bins where site measurement density is significantly lower than area density
  areaStats.bins.forEach((areaBin, idx) => {
    const siteBin = siteStats.bins[idx]
    if (!siteBin) return

    const siteDensity = siteBin.density || 0
    const areaDensity = areaBin.density || 0
    const isPeak = areaDensity >= peakThreshold

    // Track total peak area for percentage calculation
    if (isPeak) {
      totalPeakAreaCount += areaBin.count
    }

    // Mark as undersampled if site coverage < threshold of area density
    const coverageRatio = areaDensity > 0 ? siteDensity / areaDensity : 0

    if (coverageRatio < threshold) {
      unsampledBins.push({
        binIndex: idx,
        min: areaBin.min,
        max: areaBin.max,
        siteCount: siteBin.count,
        areaCount: areaBin.count,
        coverageRatio: parseFloat(coverageRatio.toFixed(3)),
        isPeak: isPeak
      })

      underSampledAreaCount += areaBin.count
      if (isPeak) {
        underSampledPeakCount += areaBin.count
      }
    }
  })

  // Calculate percentages
  const missingPercent = totalAreaCount > 0 ? (underSampledAreaCount / totalAreaCount) * 100 : 0
  // peakMissingPercent = % of peak area that is missing (not % of total area)
  const peakMissingPercent = totalPeakAreaCount > 0 ? (underSampledPeakCount / totalPeakAreaCount) * 100 : 0

  logger.debug('priorityGridAlgorithm', `Found ${unsampledBins.length} undersampled value ranges, total missing: ${missingPercent.toFixed(1)}%, peak missing: ${peakMissingPercent.toFixed(1)}%`)
  unsampledBins.forEach(bin => {
    logger.debug('priorityGridAlgorithm', `  Range [${bin.min.toFixed(1)}-${bin.max.toFixed(1)}]: coverage ${(bin.coverageRatio * 100).toFixed(1)}%, site=${bin.siteCount}, area=${bin.areaCount}${bin.isPeak ? ' [PEAK]' : ''}`)
  })

  return {
    bins: unsampledBins,
    missingPercent: parseFloat(missingPercent.toFixed(1)),
    peakMissingPercent: parseFloat(peakMissingPercent.toFixed(1))
  }
}

// Create weighted mask: 0 if well-sampled, areaBin.count/total if undersampled.
// Weight = proportion of landscape in that bin, so histogram peaks get higher priority than rare tails.
// Uses full areaHistogram for correct bin boundaries (fixes old binIndex mismatch bug).
function createBinaryMask(rasterData, unsampledRanges, areaHistogram) {
  const { width, height, pixels } = rasterData
  const mask = new Float32Array(width * height)

  if (!unsampledRanges.length) return mask

  // Build weight lookup: binIndex (in full histogram) → area proportion weight
  const bins = areaHistogram?.bins
  if (!bins?.length) {
    // Fallback: no histogram available, use binary 0/1
    const unsampledSet = new Set(unsampledRanges.map(r => r.binIndex))
    const fullMin = unsampledRanges[0].min
    const fullMax = unsampledRanges[unsampledRanges.length - 1].max
    const fullRange = fullMax - fullMin || 1
    const binCount = unsampledRanges.length
    for (let i = 0; i < pixels.length; i++) {
      const v = pixels[i]
      if (!isFinite(v) || v < fullMin || v > fullMax) continue
      let idx = Math.floor((v - fullMin) / (fullRange / binCount))
      if (idx >= binCount) idx = binCount - 1
      if (unsampledSet.has(unsampledRanges[idx]?.binIndex)) mask[i] = 1
    }
    return mask
  }

  const totalAreaCount = bins.reduce((s, b) => s + (b.count || 0), 0) || 1
  // Map binIndex → weight (area proportion), only for undersampled bins
  const weightMap = new Map()
  unsampledRanges.forEach(r => weightMap.set(r.binIndex, (r.areaCount || 1) / totalAreaCount))

  const binCount = bins.length
  const fullMin = bins[0].min
  const fullMax = bins[binCount - 1].max
  const fullRange = fullMax - fullMin || 1
  const binWidth = fullRange / binCount

  for (let i = 0; i < pixels.length; i++) {
    const v = pixels[i]
    if (!isFinite(v) || v < fullMin || v > fullMax) continue
    let binIdx = Math.floor((v - fullMin) / binWidth)
    if (binIdx >= binCount) binIdx = binCount - 1
    if (binIdx < 0) binIdx = 0
    const w = weightMap.get(binIdx)
    if (w !== undefined) mask[i] = w
  }

  return mask
}

// Calculate priority weight for a category based on how much is missing and where
// Uses parameter-specific thresholds from config (can vary by distribution shape)
function calculateCategoryPriorityWeight(missingPercent, peakMissingPercent, categoryName = 'other') {
  const thresholds = getThresholdsForParameter(categoryName)

  if (missingPercent > thresholds.critical || peakMissingPercent > (thresholds.critical + 10)) {
    return 4 // Critical
  } else if (missingPercent > thresholds.high || peakMissingPercent > (thresholds.high + 10)) {
    return 3 // High
  } else if (missingPercent > thresholds.medium || peakMissingPercent > (thresholds.medium + 10)) {
    return 2 // Medium
  } else if (missingPercent > 0) {
    return 1 // Low
  }
  return 0 // Fully sampled
}

// Find minimum resolution (largest pixel size) from all rasters
function findMinResolution(rasters) {
  let minRes = Infinity

  Object.values(rasters).forEach(raster => {
    if (raster?.pixelWidth) {
      minRes = Math.max(minRes, Math.abs(raster.pixelWidth))
    }
  })

  if (!isFinite(minRes)) {
    minRes = 100 // Fallback to 100m
    logger.warn('priorityGridAlgorithm', 'Could not determine resolution, using 100m fallback')
  }

  logger.debug('priorityGridAlgorithm', `Minimum resolution (target pixel size): ${minRes.toFixed(2)} units`)
  return minRes
}

// Align grid to common origin (snap to grid)
function alignGridOrigin(bounds, resolution) {
  return {
    west: Math.floor(bounds.west / resolution) * resolution,
    south: Math.floor(bounds.south / resolution) * resolution
  }
}

// Resample raster to new resolution (downsampling with OR logic for binary masks)
function resampleBinaryMask(mask, sourceRaster, targetResolution, polygonBounds, alignedOrigin) {
  // Extract pixel dimensions from geotransform if not directly available
  let srcPixelWidth = sourceRaster.pixelWidth
  let srcPixelHeight = sourceRaster.pixelHeight

  if (!srcPixelWidth && sourceRaster.geotransform) {
    srcPixelWidth = Math.abs(sourceRaster.geotransform[1])
    srcPixelHeight = Math.abs(sourceRaster.geotransform[5])
  }

  const { width: srcWidth, height: srcHeight, bounds: srcBounds } = sourceRaster

  // Calculate target grid dimensions
  const targetWidth = Math.ceil((polygonBounds.east - alignedOrigin.west) / targetResolution)
  const targetHeight = Math.ceil((polygonBounds.north - alignedOrigin.south) / targetResolution)

  const targetMask = new Float32Array(targetWidth * targetHeight)

  // For each target pixel, take the max weight of overlapping source pixels
  for (let ty = 0; ty < targetHeight; ty++) {
    for (let tx = 0; tx < targetWidth; tx++) {
      const targetIdx = ty * targetWidth + tx
      let maxVal = 0

      const tPixelWest = alignedOrigin.west + tx * targetResolution
      const tPixelEast = tPixelWest + targetResolution
      const tPixelSouth = alignedOrigin.south + ty * targetResolution
      const tPixelNorth = tPixelSouth + targetResolution

      const srcStartX = Math.max(0, Math.floor((tPixelWest - srcBounds.west) / srcPixelWidth))
      const srcEndX = Math.min(srcWidth - 1, Math.floor((tPixelEast - srcBounds.west) / srcPixelWidth))
      const srcStartY = Math.max(0, Math.floor((tPixelSouth - srcBounds.south) / (srcPixelHeight || srcPixelWidth)))
      const srcEndY = Math.min(srcHeight - 1, Math.floor((tPixelNorth - srcBounds.south) / (srcPixelHeight || srcPixelWidth)))

      for (let sy = srcStartY; sy <= srcEndY; sy++) {
        for (let sx = srcStartX; sx <= srcEndX; sx++) {
          const v = mask[sy * srcWidth + sx]
          if (v > maxVal) maxVal = v
        }
      }

      targetMask[targetIdx] = maxVal
    }
  }

  return { mask: targetMask, width: targetWidth, height: targetHeight }
}

// Main algorithm: create priority grid with real raster data
export function createPriorityGrid(rastersByCategory, rasterDataCache, histogramsByCategory, polygon) {
  logger.debug('priorityGridAlgorithm', '🎯 Starting priority grid calculation with real data')

  if (!polygon) {
    logger.error('priorityGridAlgorithm', 'No polygon provided')
    return { error: 'No study polygon defined' }
  }

  let polygonBounds
  try {
    polygonBounds = getPolygonBounds(polygon)
    if (!polygonBounds || !polygonBounds.west) {
      throw new Error('getPolygonBounds returned invalid bounds')
    }
  } catch (err) {
    logger.error('priorityGridAlgorithm', `Error getting polygon bounds: ${err.message}`)
    // Fallback: extract bounds manually
    try {
      let geom = polygon
      if (polygon.type === 'FeatureCollection' && polygon.features.length > 0) {
        geom = polygon.features[0].geometry
      } else if (polygon.type === 'Feature') {
        geom = polygon.geometry
      }

      const coords = geom.coordinates[0]
      const lons = coords.map(c => c[0])
      const lats = coords.map(c => c[1])

      polygonBounds = {
        west: Math.min(...lons),
        east: Math.max(...lons),
        south: Math.min(...lats),
        north: Math.max(...lats)
      }
      logger.debug('priorityGridAlgorithm', 'Using fallback bounds extraction')
    } catch (fallbackErr) {
      logger.error('priorityGridAlgorithm', `Fallback bounds extraction failed: ${fallbackErr.message}`)
      return { error: 'Cannot determine polygon bounds' }
    }
  }

  logger.debug('priorityGridAlgorithm', `Polygon bounds: W=${polygonBounds.west.toFixed(4)}, E=${polygonBounds.east.toFixed(4)}, S=${polygonBounds.south.toFixed(4)}, N=${polygonBounds.north.toFixed(4)}`)

  // Step 1: Identify undersampled value ranges for each category
  const unsampledByCategory = {}
  const categoryPriorityWeights = {}

  Object.entries(histogramsByCategory).forEach(([category, result]) => {
    // analysisResults contains siteHistogram and areaHistogram
    if (result?.siteHistogram && result?.areaHistogram) {
      const unsampledResult = findUnsampledRanges(result.siteHistogram, result.areaHistogram)
      unsampledByCategory[category] = unsampledResult

      // Calculate priority weight for this category using parameter-specific thresholds
      const weight = calculateCategoryPriorityWeight(
        unsampledResult.missingPercent,
        unsampledResult.peakMissingPercent,
        category  // Pass category name to use specific thresholds
      )
      categoryPriorityWeights[category] = weight

      const priorityLevel = weight === 4 ? 'CRITICAL' : weight === 3 ? 'HIGH' : weight === 2 ? 'MEDIUM' : weight === 1 ? 'LOW' : 'NONE'
      logger.debug('priorityGridAlgorithm', `  ${category}: ${unsampledResult.missingPercent.toFixed(1)}% missing, ${unsampledResult.peakMissingPercent.toFixed(1)}% peak missing → ${priorityLevel}`)
    } else {
      categoryPriorityWeights[category] = 0
    }
  })

  logger.debug('priorityGridAlgorithm', `Found undersampled ranges for: ${Object.keys(unsampledByCategory).join(', ')}`)

  // Step 2: Create binary masks for each raster from real data
  logger.debug('priorityGridAlgorithm', '📊 Creating binary masks from raster data')
  logger.debug('priorityGridAlgorithm', `  Available rasters: ${Object.keys(rastersByCategory).join(', ')}`)
  logger.debug('priorityGridAlgorithm', `  Cached raster data: ${Object.keys(rasterDataCache).join(', ')}`)
  logger.debug('priorityGridAlgorithm', `  Undersampled categories: ${Object.keys(unsampledByCategory).join(', ')}`)

  const binaryMasks = {}

  Object.entries(rastersByCategory).forEach(([category, rasterInfo]) => {
    if (!rasterInfo) {
      logger.warn('priorityGridAlgorithm', `  ⚠️ No raster info for ${category}`)
      return
    }

    if (!rasterDataCache[category]) {
      logger.warn('priorityGridAlgorithm', `  ⚠️ No cached data for ${category}`)
      return
    }

    const rasterData = rasterDataCache[category]
    const unsampledResult = unsampledByCategory[category]

    if (!unsampledResult || !unsampledResult.bins || unsampledResult.bins.length === 0) {
      logger.debug('priorityGridAlgorithm', `  ✓ ${category}: all values well-sampled, skipping`)
      return
    }

    try {
      const areaHistogram = histogramsByCategory[category]?.areaHistogram
      const mask = createBinaryMask(rasterData, unsampledResult.bins, areaHistogram)
      binaryMasks[category] = {
        mask,
        rasterData,
        rasterInfo,
        priorityWeight: categoryPriorityWeights[category]
      }
      logger.debug('priorityGridAlgorithm', `  ✓ Created binary mask for ${category} (${mask.length} pixels, weight=${categoryPriorityWeights[category]})`)
    } catch (maskErr) {
      logger.error('priorityGridAlgorithm', `  Error creating mask for ${category}: ${maskErr.message}`)
    }
  })

  if (Object.keys(binaryMasks).length === 0) {
    logger.error('priorityGridAlgorithm', 'No binary masks created')
    return { error: 'No raster data available for analysis' }
  }

  // Step 3: Determine target resolution based on raster sizes
  // Use the SMALLEST raster's pixel dimensions as the target resolution
  // This ensures we don't lose detail
  let targetResolution
  let smallestRasterWidth = Infinity
  let smallestRasterHeight = Infinity

  Object.values(binaryMasks).forEach(({ rasterData }) => {
    if (rasterData.width < smallestRasterWidth) {
      smallestRasterWidth = rasterData.width
      smallestRasterHeight = rasterData.height
    }
  })

  if (smallestRasterWidth !== Infinity) {
    // Use the smallest raster's dimensions to create a proportional grid
    const polygonWidth = polygonBounds.east - polygonBounds.west
    const polygonHeight = polygonBounds.north - polygonBounds.south

    // Scale to match the smallest raster aspect ratio
    targetResolution = Math.max(
      polygonWidth / smallestRasterWidth,
      polygonHeight / smallestRasterHeight
    )

    logger.debug('priorityGridAlgorithm', `📐 Target resolution based on smallest raster: ${targetResolution.toFixed(4)} units`)
  } else {
    targetResolution = findMinResolution(rastersByCategory)
    logger.debug('priorityGridAlgorithm', `📐 Target resolution (fallback): ${targetResolution.toFixed(4)} units`)
  }


  // Step 4: Align grid origin
  const alignedOrigin = alignGridOrigin(polygonBounds, targetResolution)
  logger.debug('priorityGridAlgorithm', `📍 Grid aligned to origin: W=${alignedOrigin.west.toFixed(4)}, S=${alignedOrigin.south.toFixed(4)}`)

  // Step 5: Calculate target grid dimensions
  const targetWidth = Math.ceil((polygonBounds.east - alignedOrigin.west) / targetResolution)
  const targetHeight = Math.ceil((polygonBounds.north - alignedOrigin.south) / targetResolution)
  logger.debug('priorityGridAlgorithm', `📏 Target grid size: ${targetWidth} × ${targetHeight} pixels`)

  // Pre-extract polygon coordinates for pointInPolygon checks
  let polygonCoords = null
  try {
    if (polygon.geometry) {
      polygonCoords = polygon.geometry.coordinates[0]
    } else if (polygon.coordinates) {
      polygonCoords = polygon.coordinates[0]
    }
  } catch { /* will skip polygon filtering if coords unavailable */ }

  // Step 6: Create priority grid with weighted scores — strictly inside polygon
  const priorityScores = new Array(targetWidth * targetHeight).fill(null).map(() => ({
    sum: 0,
    coverage: 0,
    values: {},
    categoryContributions: {}
  }))

  // Build a boolean mask of which grid cells are inside the polygon (avoid re-checking per category)
  const insidePolygon = new Uint8Array(targetWidth * targetHeight)
  if (polygonCoords) {
    for (let ty = 0; ty < targetHeight; ty++) {
      for (let tx = 0; tx < targetWidth; tx++) {
        const cellLon = alignedOrigin.west + (tx + 0.5) * targetResolution
        const cellLat = alignedOrigin.south + (ty + 0.5) * targetResolution
        if (pointInPolygon([cellLon, cellLat], polygonCoords)) {
          insidePolygon[ty * targetWidth + tx] = 1
        }
      }
    }
  } else {
    // Fallback: treat all cells as inside if polygon coords unavailable
    insidePolygon.fill(1)
  }

  // For each target pixel, sum the weighted binary masks — only inside polygon
  for (let category in binaryMasks) {
    const { mask: binaryMask, rasterData, rasterInfo, priorityWeight } = binaryMasks[category]

    logger.debug('priorityGridAlgorithm', `  Processing ${category} (weight=${priorityWeight})...`)

    // Resample this raster to target grid
    const resampledMask = resampleBinaryMask(
      binaryMask,
      { ...rasterInfo, ...rasterData },
      targetResolution,
      polygonBounds,
      alignedOrigin
    )

    // Sum weighted contributions into priority grid (polygon cells only)
    for (let idx = 0; idx < Math.min(resampledMask.mask.length, priorityScores.length); idx++) {
      if (!insidePolygon[idx]) continue  // skip cells outside polygon

      // Apply priority weight to the mask value
      const weightedContribution = resampledMask.mask[idx] * priorityWeight
      priorityScores[idx].sum += weightedContribution
      priorityScores[idx].coverage += 1
      priorityScores[idx].categoryContributions[category] = weightedContribution

      // Store the pixel value from original raster for reference
      const ty = Math.floor(idx / targetWidth)
      const tx = idx % targetWidth

      const tPixelWest = alignedOrigin.west + tx * targetResolution
      const tPixelSouth = alignedOrigin.south + ty * targetResolution

      const srcPixelX = Math.floor((tPixelWest - rasterInfo.bounds.west) / rasterInfo.pixelWidth)
      const srcPixelY = Math.floor((tPixelSouth - rasterInfo.bounds.south) / Math.abs(rasterInfo.pixelHeight || rasterInfo.pixelWidth))

      if (srcPixelX >= 0 && srcPixelX < rasterData.width && srcPixelY >= 0 && srcPixelY < rasterData.height) {
        const srcIdx = srcPixelY * rasterData.width + srcPixelX
        if (srcIdx >= 0 && srcIdx < rasterData.pixels.length) {
          const raw = rasterData.pixels[srcIdx]
          // Skip NoData / NA sentinels (-9999, -9998, -32768, large fills) so they
          // never appear in the planner table's value columns.
          if (isFinite(raw) && raw > -9000 && raw < 1e20) {
            priorityScores[idx].values[category] = parseFloat(raw.toFixed(1))
          }
        }
      }
    }
  }

  logger.debug('priorityGridAlgorithm', `✅ Priority grid created: ${priorityScores.filter(p => p.sum > 0).length} pixels with priority > 0`)

  return {
    success: true,
    polygonBounds,
    targetResolution,
    alignedOrigin,
    targetWidth,
    targetHeight,
    priorityScores,
    unsampledByCategory
  }
}

// Create candidate points with clustered hierarchical sampling
// High-priority zones get denser point clusters, low-priority areas get sparse coverage
// Uses percentile-based thresholds to adapt to actual priority distribution
export function generateCandidatePoints(priorityGrid, priorityScores, alignedOrigin, targetResolution, topN = 20) {
  const candidates = []

  // Calculate priority statistics for adaptive thresholding
  // NOTE: avoid Math.max(...bigArray) spread — blows stack on large rasters
  const priorities = priorityScores.filter(p => p.sum > 0).map(p => p.sum)
  let maxPriority = 1
  let minPriority = 0
  for (const p of priorities) {
    if (p > maxPriority) maxPriority = p
    if (p < minPriority) minPriority = p
  }

  // Sort for percentile calculation (slice avoids mutating original)
  const sortedPriorities = priorities.slice().sort((a, b) => b - a)
  const high75Idx = Math.floor(sortedPriorities.length * 0.25) // Top 25%
  const high50Idx = Math.floor(sortedPriorities.length * 0.50) // Top 50%

  const thresholdHigh = sortedPriorities[high75Idx] || maxPriority * 0.75
  const thresholdMedium = sortedPriorities[high50Idx] || maxPriority * 0.5

  logger.debug('priorityGridAlgorithm', `Priority thresholds: high≥${thresholdHigh.toFixed(1)}, medium≥${thresholdMedium.toFixed(1)}, max=${maxPriority.toFixed(1)}`)

  // Collect all pixels with scores
  for (let idx = 0; idx < priorityScores.length; idx++) {
    if (priorityScores[idx].sum > 0) {
      const ty = Math.floor(idx / priorityGrid.width)
      const tx = idx % priorityGrid.width
      const priority = priorityScores[idx].sum

      // One candidate per cell at its center — preserves spatial uniqueness so
      // top-N by priority gives N different locations spread across the grid.
      let zoneLevel = 'low'
      if (priority >= thresholdHigh) zoneLevel = 'critical'
      else if (priority >= thresholdMedium) zoneLevel = 'high'
      else if (priority > 0) zoneLevel = 'medium'

      const lon = alignedOrigin.west + (tx + 0.5) * targetResolution
      const lat = alignedOrigin.south + (ty + 0.5) * targetResolution

      candidates.push({
        index: idx,
        lon: parseFloat(lon.toFixed(6)),
        lat: parseFloat(lat.toFixed(6)),
        priority: parseFloat(priority.toFixed(1)),
        zoneLevel,
        coverage: priorityScores[idx].coverage,
        values: priorityScores[idx].values
      })
    }
  }

  // Sort by priority descending
  candidates.sort((a, b) => b.priority - a.priority)

  logger.debug('priorityGridAlgorithm', `Generated ${candidates.length} candidate points with weighted hierarchical clustering, returning top ${topN}`)

  return candidates.slice(0, topN)
}

// Utility: Get value ranges for display
export function getValueRangesForCategory(histogram, unsampledResult) {
  if (!histogram?.bins) return { all: [], undersampled: [], missingPercent: 0, peakMissingPercent: 0 }

  const allRanges = histogram.bins.map((bin, idx) => ({
    index: idx,
    min: bin.min.toFixed(1),
    max: bin.max.toFixed(1),
    count: bin.count,
    percentage: bin.percentage
  }))

  // Handle both old format (array) and new format (object with bins property)
  const binsArray = Array.isArray(unsampledResult) ? unsampledResult : unsampledResult?.bins || []
  const missingPercent = unsampledResult?.missingPercent || 0
  const peakMissingPercent = unsampledResult?.peakMissingPercent || 0

  const unsampledRanges = binsArray.map(bin => ({
    index: bin.binIndex,
    min: bin.min.toFixed(1),
    max: bin.max.toFixed(1),
    coverageRatio: bin.coverageRatio,
    isPeak: bin.isPeak
  }))

  return { all: allRanges, undersampled: unsampledRanges, missingPercent, peakMissingPercent }
}
