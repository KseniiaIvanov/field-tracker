import { useState, useMemo } from 'react'
import logger from '../utils/logger'
import { pointInPolygon, isNoDataValue } from '../utils/rasterProcessing'
import RasterViewer from './RasterViewer'
import PriorityHeatMapViewer from './PriorityHeatMapViewer'
import {
  createPriorityGrid,
  findUnsampledRanges
} from '../utils/priorityGridAlgorithm'

const CATEGORIES = {
  moisture: { label: 'Moisture', color: '#2196F3' },
  vegetation: { label: 'Vegetation', color: '#4CAF50' },
  disturbance: { label: 'Disturbance', color: '#FF9800' },
  other: { label: 'Other', color: '#9C27B0' }
}

export default function MeasurementPlanner({
  rastersByCategory,
  rasterDataCache,
  rgbDataCache,
  histogramsByCategory,
  polygon,
  sitesData,
  onCandidatePointsGenerated
}) {
  const [candidatePoints, setCandidatePoints] = useState([])
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState(null)
  const [priorityThreshold, setPriorityThreshold] = useState(1)
  const [coverageThreshold, setCoverageThreshold] = useState('all')
  const [showHeatMap, setShowHeatMap] = useState(false)
  const [priorityGrid, setPriorityGrid] = useState(null)
  const [heatMapOpacity, setHeatMapOpacity] = useState(0.4)
  const [minDistanceStr, setMinDistanceStr] = useState('1')
  const [maxPointsStr, setMaxPointsStr] = useState('10')
  const minDistanceM = Math.max(1, parseInt(minDistanceStr) || 1)
  const maxPoints = Math.max(1, parseInt(maxPointsStr) || 1)

  // Derive summary + recommended N from existing analysis results (no re-analysis needed)
  const { analysisSummary, recommendedN } = useMemo(() => {
    const cats = Object.keys(histogramsByCategory)
    if (cats.length === 0) return { analysisSummary: null, recommendedN: null }

    let worstMissingPercent = 0
    let maxSites = 0

    const summary = cats.map(cat => {
      const result = histogramsByCategory[cat]
      const catInfo = CATEGORIES[cat]

      // Re-use findUnsampledRanges to get missingPercent for recommendation
      let missingPercent = 0
      if (result?.siteHistogram && result?.areaHistogram) {
        try {
          const ur = findUnsampledRanges(result.siteHistogram, result.areaHistogram)
          missingPercent = ur.missingPercent || 0
        } catch { /* ignore */ }
      }

      const n = result?.siteHistogram?.stats?.count || result?.sitesAnalyzed || 0
      if (missingPercent > worstMissingPercent) worstMissingPercent = missingPercent
      if (n > maxSites) maxSites = n

      return {
        category: cat,
        label: catInfo?.label || cat,
        color: catInfo?.color || '#999',
        assessment: result?.coverage?.assessment || '—',
        distributionMatch: result?.coverage?.distributionMatch || '—',
        missingPercent,
        sitesCount: n
      }
    })

    // Recommended new points: 5 measurements per undersampled value bin (minimum for statistics).
    // Count bins across all categories where site coverage < 30% of area density.
    let rec = null
    let maxUnsampledBins = 0
    cats.forEach(cat => {
      const result = histogramsByCategory[cat]
      if (result?.siteHistogram && result?.areaHistogram) {
        try {
          const ur = findUnsampledRanges(result.siteHistogram, result.areaHistogram)
          if (ur.bins.length > maxUnsampledBins) maxUnsampledBins = ur.bins.length
        } catch { /* ignore */ }
      }
    })
    if (maxUnsampledBins > 0) {
      rec = Math.min(maxUnsampledBins * 5, 80)
    }

    return { analysisSummary: summary, recommendedN: rec }
  }, [histogramsByCategory])

  const canGenerate = !isCalculating && !!polygon && Object.keys(histogramsByCategory).length > 0 && Object.keys(rasterDataCache).length > 0

  function distMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000
    const dLat = (lat2 - lat1) * Math.PI / 180 * R
    const dLon = (lon2 - lon1) * Math.PI / 180 * R * Math.cos(lat1 * Math.PI / 180)
    return Math.sqrt(dLat * dLat + dLon * dLon)
  }

  function distToSegmentM(lat, lon, lat1, lon1, lat2, lon2) {
    const R = 6371000
    const cosLat = Math.cos(lat * Math.PI / 180)
    const s = Math.PI / 180 * R
    const px = (lon - lon1) * s * cosLat, py = (lat - lat1) * s
    const dx = (lon2 - lon1) * s * cosLat, dy = (lat2 - lat1) * s
    const lenSq = dx * dx + dy * dy
    if (lenSq === 0) return Math.sqrt(px * px + py * py)
    const t = Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq))
    return Math.sqrt((px - t * dx) ** 2 + (py - t * dy) ** 2)
  }

  function isTooCloseToEdge(lat, lon, polygonCoords, bufferM) {
    for (let i = 0; i < polygonCoords.length - 1; i++) {
      if (distToSegmentM(lat, lon, polygonCoords[i][1], polygonCoords[i][0], polygonCoords[i + 1][1], polygonCoords[i + 1][0]) < bufferM) return true
    }
    return false
  }

  const handleCalculate = async () => {
    try {
      setError(null)
      setIsCalculating(true)

      if (!polygon) throw new Error('No study polygon defined. Draw or upload a polygon first.')
      if (Object.keys(rasterDataCache).length === 0) throw new Error('No raster data loaded. Upload rasters and run analysis first.')
      if (Object.keys(histogramsByCategory).length === 0) throw new Error('No analysis results found. Run analysis in the Raster Analysis tab first.')

      logger.debug('MeasurementPlanner', '🎯 Starting priority grid calculation')

      const result = createPriorityGrid(
        rastersByCategory,
        rasterDataCache,
        histogramsByCategory,
        polygon
      )

      if (result.error) throw new Error(result.error)

      const priorityGridData = {
        width: result.targetWidth,
        height: result.targetHeight,
        cells: result.priorityScores.map(p => p.sum)
      }
      setPriorityGrid(priorityGridData)

      const polygonCoords = polygon.geometry ? polygon.geometry.coordinates[0] : polygon.coordinates[0]
      const { alignedOrigin, targetResolution, targetWidth, targetHeight, priorityScores } = result

      // ── Build candidates across the WHOLE polygon interior ──────────────────────
      // The old approach only used cells with priority > 0 (undersampled value ranges).
      // When those values were spatially concentrated, every candidate sat in one corner
      // and no thinning could spread them out. Instead we now treat EVERY grid cell inside
      // the polygon as a candidate (priority 0 allowed), so points can land anywhere —
      // including right up against the border.
      const totalCells = targetWidth * targetHeight
      const stride = Math.max(1, Math.floor(Math.sqrt(totalCells / 4000))) // cap candidate pool ~4000
      const EDGE_BUFFER_M = 10  // keep planned points at least 10 m away from the polygon border
      const allCells = []
      for (let ty = 0; ty < targetHeight; ty += stride) {
        for (let tx = 0; tx < targetWidth; tx += stride) {
          const lon = alignedOrigin.west + (tx + 0.5) * targetResolution
          const lat = alignedOrigin.south + (ty + 0.5) * targetResolution
          if (!pointInPolygon([lon, lat], polygonCoords)) continue
          // Reject cells too close to the polygon edge so points never sit on the border.
          if (isTooCloseToEdge(lat, lon, polygonCoords, EDGE_BUFFER_M)) continue
          const ps = priorityScores[ty * targetWidth + tx] || { sum: 0, coverage: 0, values: {} }
          allCells.push({
            lon: parseFloat(lon.toFixed(6)),
            lat: parseFloat(lat.toFixed(6)),
            priority: parseFloat((ps.sum || 0).toFixed(1)),
            coverage: ps.coverage || 0,
            values: ps.values || {}
          })
        }
      }

      if (allCells.length === 0) {
        throw new Error('No grid cells fall inside the polygon (after 10 m edge buffer). Check polygon/raster alignment.')
      }

      // ── Farthest-point sampling, weighted by priority ───────────────────────────
      // Seed with the highest-priority cell (the single most undersampled spot is always
      // covered). Then each next point maximizes (distance-to-nearest-selected) × priority
      // nudge — distance dominates so points spread evenly across the whole polygon, while
      // the nudge biases toward undersampled areas. This is "uniform grid weighted by
      // priority" and naturally pushes points outward toward the borders too.
      let maxPri = 0
      for (const c of allCells) if (c.priority > maxPri) maxPri = c.priority
      const priNorm = c => (maxPri > 0 ? c.priority / maxPri : 0)
      const PRIORITY_NUDGE = 0.5

      let seed = allCells[0]
      for (const c of allCells) if (c.priority > seed.priority) seed = c
      const selected = [seed]
      const nearest = allCells.map(c => distMeters(c.lat, c.lon, seed.lat, seed.lon))

      while (selected.length < maxPoints && selected.length < allCells.length) {
        let bestIdx = -1
        let bestScore = -Infinity
        for (let i = 0; i < allCells.length; i++) {
          const d = nearest[i]
          if (d <= 0) continue                  // already selected
          if (d < minDistanceM) continue        // respect user's hard minimum distance
          const score = d * (1 + PRIORITY_NUDGE * priNorm(allCells[i]))
          if (score > bestScore) { bestScore = score; bestIdx = i }
        }
        if (bestIdx === -1) break               // nothing left satisfies min distance
        const chosen = allCells[bestIdx]
        selected.push(chosen)
        for (let i = 0; i < allCells.length; i++) {
          const d = distMeters(allCells[i].lat, allCells[i].lon, chosen.lat, chosen.lon)
          if (d < nearest[i]) nearest[i] = d
        }
        nearest[bestIdx] = 0
      }

      logger.debug('MeasurementPlanner', `📐 ${allCells.length} interior cells → selected ${selected.length} points (FPS, min dist ${minDistanceM} m)`)

      // Label zones by priority rank so the table still highlights undersampled points,
      // while the spatial spread comes from the farthest-point sampling above.
      const sortedByPri = [...selected].sort((a, b) => b.priority - a.priority)
      const rankMap = new Map(sortedByPri.map((c, i) => [c, i]))
      const n = selected.length
      const candidates = selected.map(pt => {
        const rank = n > 1 ? rankMap.get(pt) / (n - 1) : 0
        const zoneLevel = rank < 0.25 ? 'critical' : rank < 0.5 ? 'high' : rank < 0.75 ? 'medium' : 'low'
        return { ...pt, zoneLevel }
      })

      setCandidatePoints(candidates)
      if (onCandidatePointsGenerated) onCandidatePointsGenerated(candidates)

      logger.debug('MeasurementPlanner', `✅ Generated ${candidates.length} candidate points`)
    } catch (err) {
      logger.error('MeasurementPlanner', 'Calculation error:', err.message)
      setError(err.message)
    } finally {
      setIsCalculating(false)
    }
  }

  // Enrich candidate points with actual raster values
  const enrichedCandidatePoints = useMemo(() => {
    if (candidatePoints.length === 0 || !rasterDataCache) return candidatePoints
    return candidatePoints.map(point => {
      const enrichedPoint = { ...point, values: {} }
      Object.entries(CATEGORIES).forEach(([category]) => {
        const raster = rasterDataCache[category]
        if (!raster?.geotransform || !raster?.pixels) return
        try {
          const gt = raster.geotransform
          const px = Math.round((point.lon - gt[0]) / gt[1])
          const py = Math.round((point.lat - gt[3]) / gt[5])
          if (px >= 0 && px < raster.width && py >= 0 && py < raster.height) {
            const value = parseFloat(raster.pixels[py * raster.width + px])
            if (isFinite(value) && !isNoDataValue(value, raster)) {
              enrichedPoint.values[category] = parseFloat(value.toFixed(1))
            }
          }
        } catch { /* skip */ }
      })
      enrichedPoint.coverage = Object.keys(enrichedPoint.values).length
      return enrichedPoint
    })
  }, [candidatePoints, rasterDataCache])

  const filteredCandidates = useMemo(() => {
    const zoneLevelMap = {
      1: ['critical', 'high', 'medium', 'low'],
      2: ['critical', 'high', 'medium'],
      3: ['critical', 'high'],
      4: ['critical']
    }
    const allowedZones = zoneLevelMap[priorityThreshold] || zoneLevelMap[1]
    let filtered = enrichedCandidatePoints.filter(p => allowedZones.includes(p.zoneLevel))
    if (coverageThreshold !== 'all') {
      filtered = filtered.filter(p => p.coverage >= parseInt(coverageThreshold))
    }
    return filtered
  }, [enrichedCandidatePoints, priorityThreshold, coverageThreshold])

  return (
    <div style={{ padding: '0' }}>
      {/* Header card */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '2px solid #2196F3',
        borderRadius: '12px',
        overflow: 'hidden',
        marginBottom: '16px'
      }}>
        <div style={{
          padding: '16px 20px',
          backgroundColor: 'rgba(33, 150, 243, 0.08)',
          borderBottom: '1px solid rgba(33, 150, 243, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '16px' }}>
              📍 Generate Next Measurement Points
            </h3>
            {analysisSummary && (
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                {analysisSummary.map(s => (
                  <span key={s.category}>
                    <span style={{ color: s.color }}>■</span> {s.label}: <strong>{s.distributionMatch}%</strong> match
                    {s.missingPercent > 5 && (
                      <span style={{ color: '#FF5722' }}> · {s.missingPercent.toFixed(0)}% undersampled</span>
                    )}
                  </span>
                ))}
              </div>
            )}
            {recommendedN !== null && (
              <div style={{
                marginTop: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                backgroundColor: 'rgba(255, 152, 0, 0.15)',
                border: '1px solid #FF9800',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '600',
                color: '#E65100'
              }}>
                🎯 ~{recommendedN} new points recommended
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <label htmlFor="maxPts" style={{ whiteSpace: 'nowrap' }}>Points to collect:</label>
                <input
                  id="maxPts"
                  type="text"
                  inputMode="numeric"
                  value={maxPointsStr}
                  onChange={e => setMaxPointsStr(e.target.value)}
                  onBlur={e => setMaxPointsStr(String(Math.max(1, parseInt(e.target.value) || 1)))}
                  style={{
                    width: '55px',
                    padding: '3px 6px',
                    borderRadius: '6px',
                    border: '1px solid #4CAF50',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <label htmlFor="minDist" style={{ whiteSpace: 'nowrap' }}>Min distance:</label>
                <input
                  id="minDist"
                  type="text"
                  inputMode="numeric"
                  value={minDistanceStr}
                  onChange={e => setMinDistanceStr(e.target.value)}
                  onBlur={e => setMinDistanceStr(String(Math.max(1, parseInt(e.target.value) || 1)))}
                  style={{
                    width: '55px',
                    padding: '3px 6px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '12px'
                  }}
                />
                <span>m</span>
              </div>
            </div>
            <button
              onClick={handleCalculate}
              disabled={!canGenerate}
              style={{
                padding: '12px 24px',
                backgroundColor: canGenerate ? '#4CAF50' : '#aaa',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: canGenerate ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: '700',
                whiteSpace: 'nowrap',
                transition: 'background-color 0.2s'
              }}
            >
              {isCalculating ? '⏳ Calculating...' : '🎯 Generate Points'}
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{ padding: '10px 20px', backgroundColor: '#FFEBEE', color: '#C62828', fontSize: '13px', borderBottom: '1px solid #FFCDD2' }}>
            ❌ {error}
          </div>
        )}

        {/* Prerequisite hints when button disabled */}
        {!canGenerate && !isCalculating && (
          <div style={{ padding: '10px 20px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            {!polygon && <div>⚠️ Draw or upload a study area polygon in the Raster Analysis tab</div>}
            {Object.keys(histogramsByCategory).length === 0 && <div>⚠️ Run analysis first in the Raster Analysis tab (click ▶️ Run Analysis)</div>}
            {Object.keys(rasterDataCache).length === 0 && <div>⚠️ Raster data not loaded — re-open the app or re-upload rasters</div>}
          </div>
        )}
      </div>

      {/* Results */}
      {candidatePoints.length > 0 && (
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <strong style={{ color: 'var(--text-primary)', fontSize: '14px' }}>📊 Results</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
              {recommendedN !== null && (
                <span style={{ color: '#E65100', fontWeight: '600' }}>
                  🎯 ~{recommendedN} recommended
                </span>
              )}
              <span style={{ color: 'var(--text-secondary)' }}>
                {filteredCandidates.length}/{candidatePoints.length} shown
                {' · '}
                {candidatePoints.filter(p => p.zoneLevel === 'critical' || p.zoneLevel === 'high').length} high-priority
              </span>
            </div>
          </div>

          <div style={{ padding: '16px' }}>
            {/* Map — use RGB if available, else fall back to first thematic raster */}
            {(() => {
              const mapRaster = rgbDataCache || Object.values(rasterDataCache)[0] || null
              if (!mapRaster) return null
              // Cap the heat-map canvas to a sane size. Sizing it to the raw raster
              // pixel dimensions (often several thousand px) builds a huge ImageData
              // that fails silently and renders blank/white.
              const rawW = mapRaster.width || 800
              const rawH = mapRaster.height || 600
              const HEATMAP_MAX = 800
              const heatScale = Math.min(1, HEATMAP_MAX / Math.max(rawW, rawH))
              const heatMapWidth = Math.max(1, Math.round(rawW * heatScale))
              const heatMapHeight = Math.max(1, Math.round(rawH * heatScale))
              return (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      🗺️ Map View {!rgbDataCache && <span style={{ color: '#FF9800' }}>(thematic raster)</span>}
                    </span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={showHeatMap} onChange={e => setShowHeatMap(e.target.checked)} />
                      🔥 Priority heat map
                    </label>
                  </div>
                  <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #ccc' }}>
                    <RasterViewer
                      rasterData={mapRaster}
                      polygon={polygon}
                      onPolygonChange={() => {}}
                      sites={sitesData || []}
                      candidatePoints={candidatePoints}
                      opacity={1}
                      readOnly={true}
                    />
                  </div>

                  {/* Standalone priority heat map (correctly scaled, not an overlay).
                      The map above keeps the geographic context + candidate points; this
                      shows the priority field with its legend. */}
                  {showHeatMap && priorityGrid && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        🔥 Priority field (green = well-sampled, red = high priority)
                      </div>
                      <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #ccc', position: 'relative' }}>
                        <PriorityHeatMapViewer
                          priorityGrid={priorityGrid}
                          width={heatMapWidth}
                          height={heatMapHeight}
                          opacity={heatMapOpacity}
                          onOpacityChange={setHeatMapOpacity}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Filters */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '3px' }}>Priority Level</label>
                <select value={priorityThreshold} onChange={e => setPriorityThreshold(parseInt(e.target.value))}
                  style={{ width: '100%', padding: '5px 7px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '11px' }}>
                  <option value={1}>🟢 All (Low+)</option>
                  <option value={2}>🟡 Medium+</option>
                  <option value={3}>🟠 High+</option>
                  <option value={4}>🔴 Critical only</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '3px' }}>Coverage</label>
                <select value={coverageThreshold} onChange={e => setCoverageThreshold(e.target.value)}
                  style={{ width: '100%', padding: '5px 7px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '11px' }}>
                  <option value="all">All</option>
                  <option value={3}>3+ categories</option>
                  <option value={4}>All 4</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div style={{ maxHeight: '360px', overflow: 'auto', border: '1px solid #ccc', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid #ccc', position: 'sticky', top: 0 }}>
                    <th style={{ padding: '6px', textAlign: 'left', color: 'var(--text-secondary)' }}>Priority</th>
                    <th style={{ padding: '6px', textAlign: 'left', color: 'var(--text-secondary)' }}>Lat</th>
                    <th style={{ padding: '6px', textAlign: 'left', color: 'var(--text-secondary)' }}>Lon</th>
                    <th style={{ padding: '4px', textAlign: 'center', backgroundColor: '#2196F3', color: 'white' }}>M</th>
                    <th style={{ padding: '4px', textAlign: 'center', backgroundColor: '#4CAF50', color: 'white' }}>V</th>
                    <th style={{ padding: '4px', textAlign: 'center', backgroundColor: '#FF9800', color: 'white' }}>D</th>
                    <th style={{ padding: '4px', textAlign: 'center', backgroundColor: '#9C27B0', color: 'white' }}>O</th>
                    <th style={{ padding: '6px', textAlign: 'left', color: 'var(--text-secondary)' }}>Cov</th>
                    <th style={{ padding: '4px', textAlign: 'center', color: 'var(--text-secondary)' }}>Nav</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map((point, idx) => {
                    let priorityLabel = '🟢 Low'
                    if (point.zoneLevel === 'critical') priorityLabel = '🔴 Crit'
                    else if (point.zoneLevel === 'high') priorityLabel = '🟠 High'
                    else if (point.zoneLevel === 'medium') priorityLabel = '🟡 Mid'
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #eee', backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                        <td style={{ padding: '4px', fontSize: '10px' }}>{priorityLabel}</td>
                        <td style={{ padding: '4px', fontFamily: 'monospace', fontSize: '10px' }}>{point.lat.toFixed(4)}</td>
                        <td style={{ padding: '4px', fontFamily: 'monospace', fontSize: '10px' }}>{point.lon.toFixed(4)}</td>
                        <td style={{ padding: '2px', textAlign: 'center', fontSize: '10px' }}>{point.values?.moisture !== undefined ? point.values.moisture.toFixed(0) : '—'}</td>
                        <td style={{ padding: '2px', textAlign: 'center', fontSize: '10px' }}>{point.values?.vegetation !== undefined ? point.values.vegetation.toFixed(0) : '—'}</td>
                        <td style={{ padding: '2px', textAlign: 'center', fontSize: '10px' }}>{point.values?.disturbance !== undefined ? point.values.disturbance.toFixed(0) : '—'}</td>
                        <td style={{ padding: '2px', textAlign: 'center', fontSize: '10px' }}>{point.values?.other !== undefined ? point.values.other.toFixed(0) : '—'}</td>
                        <td style={{ padding: '4px', color: 'var(--text-secondary)', fontSize: '10px' }}>{point.coverage}/4</td>
                        <td style={{ padding: '2px', textAlign: 'center' }}>
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lon}&travelmode=walking`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Navigate to ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`}
                            style={{ fontSize: '14px', textDecoration: 'none' }}
                          >🧭</a>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button onClick={() => exportToCsv(filteredCandidates)}
                style={{ padding: '8px 16px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>
                📥 CSV
              </button>
              <button onClick={() => exportToKml(filteredCandidates)}
                style={{ padding: '8px 16px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}
                title="KML — import into Google My Maps to see all points">
                🗺️ KML
              </button>
              <button onClick={() => exportToGpx(filteredCandidates)}
                style={{ padding: '8px 16px', backgroundColor: '#FF9800', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}
                title="GPX — open in OsmAnd, Maps.me or Garmin">
                📡 GPX
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function exportToCsv(points) {
  const header = ['Latitude', 'Longitude', 'Priority', 'Moisture', 'Vegetation', 'Disturbance', 'Other', 'Coverage']
  const rows = points.map(p => [
    p.lat.toFixed(6), p.lon.toFixed(6), p.priority,
    p.values?.moisture?.toFixed(1) || '', p.values?.vegetation?.toFixed(1) || '',
    p.values?.disturbance?.toFixed(1) || '', p.values?.other?.toFixed(1) || '',
    p.coverage
  ])
  const csv = [header, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `measurement_points_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function exportToKml(points) {
  const date = new Date().toISOString().split('T')[0]
  const placemarks = points.map((p, i) => {
    const desc = [
      `Priority: ${p.priority} (${p.zoneLevel})`,
      p.values?.moisture !== undefined ? `Moisture: ${p.values.moisture.toFixed(1)}` : '',
      p.values?.vegetation !== undefined ? `Vegetation: ${p.values.vegetation.toFixed(1)}` : '',
      p.values?.disturbance !== undefined ? `Disturbance: ${p.values.disturbance.toFixed(1)}` : '',
      p.values?.other !== undefined ? `Other: ${p.values.other.toFixed(1)}` : ''
    ].filter(Boolean).join('&#10;')
    return `    <Placemark>
      <name>Point ${i + 1}</name>
      <description>${desc}</description>
      <styleUrl>#whiteDot</styleUrl>
      <Point><coordinates>${p.lon.toFixed(6)},${p.lat.toFixed(6)},0</coordinates></Point>
    </Placemark>`
  }).join('\n')

  // White filled dot with a black outline. placemark_circle.png is a white ring/circle;
  // <color> is AABBGGRR — ffffffff = opaque white fill. The black outline comes from the
  // icon art itself, so points render as plain white dots with a dark edge.
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Measurement Points ${date}</name>
    <Style id="whiteDot">
      <IconStyle>
        <color>ffffffff</color>
        <scale>1.1</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>
      </IconStyle>
      <LabelStyle><scale>0.8</scale></LabelStyle>
    </Style>
${placemarks}
  </Document>
</kml>`
  const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `measurement_points_${date}.kml`
  a.click()
  URL.revokeObjectURL(url)
}

function exportToGpx(points) {
  const date = new Date().toISOString().split('T')[0]
  const waypoints = points.map((p, i) => {
    const label = p.zoneLevel === 'critical' ? '[CRIT]' : p.zoneLevel === 'high' ? '[HIGH]' : p.zoneLevel === 'medium' ? '[MED]' : '[LOW]'
    const cmt = [
      `Priority: ${p.priority}`,
      p.values?.moisture !== undefined ? `M=${p.values.moisture.toFixed(1)}` : '',
      p.values?.vegetation !== undefined ? `V=${p.values.vegetation.toFixed(1)}` : '',
    ].filter(Boolean).join(' ')
    return `  <wpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}">
    <name>${label} P${i + 1}</name>
    <cmt>${cmt}</cmt>
    <sym>Flag, Blue</sym>
  </wpt>`
  }).join('\n')

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Field Tracker" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Measurement Points ${date}</name></metadata>
${waypoints}
</gpx>`
  const blob = new Blob([gpx], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `measurement_points_${date}.gpx`
  a.click()
  URL.revokeObjectURL(url)
}
