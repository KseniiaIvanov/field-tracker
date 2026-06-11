import * as turf from 'turf'

export function createPointBuffer(lat, lon, radiusMeters) {
  const point = turf.point([lon, lat])
  const buffered = turf.buffer(point, radiusMeters, { units: 'meters' })
  return buffered
}

export function pointInPolygonCheck(lat, lon, polygon) {
  const point = turf.point([lon, lat])
  return turf.booleanPointInPolygon(point, polygon)
}

export function getPolygonBoundsFeature(polygon) {
  const bbox = turf.bbox(polygon)
  return turf.bboxPolygon(bbox)
}

export function getPolygonCenter(polygon) {
  const center = turf.center(polygon)
  return {
    lat: center.geometry.coordinates[1],
    lon: center.geometry.coordinates[0]
  }
}

export function formatGeoJSON(drawnLayer) {
  // Convert Leaflet.Draw layer to GeoJSON
  if (!drawnLayer || !drawnLayer._layers) {
    return null
  }

  const features = []
  for (const layerId in drawnLayer._layers) {
    const layer = drawnLayer._layers[layerId]
    if (layer.toGeoJSON) {
      features.push(layer.toGeoJSON())
    }
  }

  if (features.length === 0) return null
  if (features.length === 1) return features[0]

  return {
    type: 'FeatureCollection',
    features
  }
}

export function parseShapefile(geojson) {
  // Extract first polygon from shapefile GeoJSON
  if (!geojson) return null

  const features = geojson.features || [geojson]

  for (const feature of features) {
    if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
      if (feature.geometry.type === 'MultiPolygon') {
        // Convert first polygon of multipolygon
        return {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: feature.geometry.coordinates[0]
          }
        }
      }
      return feature
    }
  }

  return null
}

export function sitesInPolygon(sites, polygon) {
  return sites.filter(site => pointInPolygonCheck(site.latitude, site.longitude, polygon))
}

export function calculateCoverageAssessment(siteStats, areaStats, siteBins = null, areaBins = null) {
  // Assess how well sites represent area distribution shape
  const siteMean = parseFloat(siteStats.mean)
  const siteStd = parseFloat(siteStats.std)
  const siteMin = parseFloat(siteStats.min)
  const siteMax = parseFloat(siteStats.max)

  const areaMean = parseFloat(areaStats.mean)
  const areaStd = parseFloat(areaStats.std)
  const areaMin = parseFloat(areaStats.min)
  const areaMax = parseFloat(areaStats.max)

  const areaRange = areaMax - areaMin
  const siteRange = siteMax - siteMin

  // Distribution-based assessment: how well do site stats match area stats?
  // Normalize by area range to make it scale-independent
  const meanDiff = Math.abs(siteMean - areaMean)
  const meanMatch = areaRange > 0 ? Math.max(0, 1 - meanDiff / areaRange) : 1

  // Standard deviation match (site std should be similar to area std)
  // If area has no variation (std=0), perfect match is when site also has no variation
  let stdMatch
  if (areaStd > 0) {
    const stdDiff = Math.abs(siteStd - areaStd)
    stdMatch = Math.max(0, 1 - stdDiff / areaStd)
  } else if (siteStd === 0) {
    stdMatch = 1
  } else {
    stdMatch = 0
  }

  // Range coverage: how much of the area range do sites span?
  const rangeRatio = areaRange > 0 ? siteRange / areaRange : 1
  const rangeCoverage = Math.min(1, rangeRatio)

  // Combined distribution match: average of mean and std match
  // This tells us if the site distribution shape matches the area distribution
  const distributionMatch = (meanMatch + stdMatch) / 2

  // Coverage % combines distribution shape matching with range coverage
  // This gives a metric that reflects overall representativeness
  const coverage = Math.round(distributionMatch * rangeCoverage * 100)

  // Assessment levels
  let assessment = 'Poor'
  if (distributionMatch >= 0.9 && rangeCoverage >= 0.8) {
    assessment = 'Excellent'
  } else if (distributionMatch >= 0.75 && rangeCoverage >= 0.6) {
    assessment = 'Good'
  } else if (distributionMatch >= 0.6 || rangeCoverage >= 0.5) {
    assessment = 'Partial'
  }

  // Overlap coefficient (histogram intersection): the area shared by the two
  // density curves. 0 = no overlap, 100 = identical distributions. Bins must be
  // aligned (same bin boundaries/count) for this to be meaningful.
  let overlapCoefficient = null
  if (siteBins && areaBins && siteBins.length > 0 && siteBins.length === areaBins.length) {
    const binWidth = siteBins[0].max - siteBins[0].min
    const overlap = siteBins.reduce((sum, bin, i) => sum + Math.min(bin.density, areaBins[i].density), 0) * binWidth
    overlapCoefficient = (Math.min(1, overlap) * 100).toFixed(1)
  }

  return {
    assessment,
    coverage: Math.min(coverage, 100),
    // Detailed breakdown for user understanding
    distributionMatch: (distributionMatch * 100).toFixed(1),
    rangeCoverage: (rangeCoverage * 100).toFixed(1),
    meanMatch: (meanMatch * 100).toFixed(1),
    stdMatch: (stdMatch * 100).toFixed(1),
    meanDiff: meanDiff.toFixed(3),
    stdDiff: (Math.abs(siteStd - areaStd)).toFixed(3),
    siteRange: siteRange.toFixed(3),
    areaRange: areaRange.toFixed(3),
    overlapCoefficient
  }
}

export function validatePolygon(polygon) {
  if (!polygon || !polygon.geometry || !polygon.geometry.coordinates) {
    return { valid: false, error: 'Invalid polygon structure' }
  }

  const coords = polygon.geometry.coordinates[0]
  if (!Array.isArray(coords) || coords.length < 3) {
    return { valid: false, error: 'Polygon must have at least 3 vertices' }
  }

  // Check that polygon is closed (with tolerance for floating point errors)
  const first = coords[0]
  const last = coords[coords.length - 1]
  const tolerance = 1e-10 // Allow for floating point precision issues

  if (Math.abs(first[0] - last[0]) > tolerance || Math.abs(first[1] - last[1]) > tolerance) {
    // Auto-close the polygon if it's not closed
    console.log('Polygon not closed - auto-closing')
    coords.push(first)
  }

  return { valid: true }
}
