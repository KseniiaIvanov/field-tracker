import { useState, useEffect, useMemo, useRef } from 'react'
import logger from '../utils/logger'
import { pointInPolygon, getPolygonBounds } from '../utils/rasterProcessing'
import RasterViewer from './RasterViewer'
import AnalysisInsights from './AnalysisInsights'
import PriorityHeatMapViewer from './PriorityHeatMapViewer'
import {
  findUnsampledRanges,
  createPriorityGrid,
  generateCandidatePoints as generatePointsFromGrid,
  getValueRangesForCategory
} from '../utils/priorityGridAlgorithm'
import { analyzeDistributionShape } from '../config/algorithmConfig'
import { suggestOptimalSampleSize, generatePowerReport } from '../utils/powerAnalysis'

export default function MeasurementPlanner({
  rastersByCategory,
  rasterDataCache,
  rgbDataCache,
  histogramsByCategory,
  polygon,
  sitesData,
  onCandidatePointsGenerated,
  analysisTabs
}) {
  const [unsampledAnalysis, setUnsampledAnalysis] = useState({})
  const [distributionAdvice, setDistributionAdvice] = useState({})
  const [powerAnalysis, setPowerAnalysis] = useState(null)
  const [candidatePoints, setCandidatePoints] = useState([])
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('vegetation')
  const [priorityThreshold, setPriorityThreshold] = useState(1)
  const [coverageThreshold, setCoverageThreshold] = useState('all')
  const [showHeatMap, setShowHeatMap] = useState(false)
  const [priorityGrid, setPriorityGrid] = useState(null)
  const [heatMapOpacity, setHeatMapOpacity] = useState(0.4)

  const CATEGORIES = {
    moisture: { label: 'Moisture', color: '#2196F3' },
    vegetation: { label: 'Vegetation', color: '#4CAF50' },
    disturbance: { label: 'Disturbance', color: '#FF9800' },
    other: { label: 'Other', color: '#9C27B0' }
  }

  // Analyze unsampled ranges on mount or when data changes
  const histogramsRef = useRef(null)
  const analysisCountRef = useRef(0)  // Prevent infinite loops

  useEffect(() => {
    // Safety limit: prevent infinite loops by tracking call count
    analysisCountRef.current++
    if (analysisCountRef.current > 100) {
      logger.error('MeasurementPlanner', '❌ SAFETY: Analysis function called >100 times, stopping to prevent infinite loop')
      return
    }

    // Only run if histogramsByCategory actually changed (not just parent re-render)
    const histogramsStr = JSON.stringify(histogramsByCategory)
    if (histogramsRef.current === histogramsStr) return
    histogramsRef.current = histogramsStr

    const analyzeUnsampled = () => {
      logger.debug('MeasurementPlanner', '📊 Analyzing undersampled value ranges')

      const analysis = {}
      const distAdvice = {}
      let hasAnyUnsampled = false

      Object.entries(histogramsByCategory).forEach(([category, result]) => {
        // analysisResults contains siteHistogram and areaHistogram
        if (result?.siteHistogram && result?.areaHistogram) {
          const unsampledResult = findUnsampledRanges(result.siteHistogram, result.areaHistogram)
          const ranges = getValueRangesForCategory(result.areaHistogram, unsampledResult)

          // Handle both old (array) and new (object with bins) formats
          const unsampledBinsArray = Array.isArray(unsampledResult) ? unsampledResult : unsampledResult?.bins || []
          const hasUnsampled = unsampledBinsArray.length > 0

          analysis[category] = {
            unsampledBins: unsampledResult,
            allRanges: ranges.all,
            unsampledRanges: ranges.undersampled,
            hasUnsampled,
            missingPercent: ranges.missingPercent,
            peakMissingPercent: ranges.peakMissingPercent
          }

          // Analyze distribution shape and get recommendations
          try {
            const distShape = analyzeDistributionShape(result.areaHistogram)
            distAdvice[category] = {
              shape: distShape.shape,
              skewness: distShape.skewness,
              kurtosis: distShape.kurtosis,
              recommendation: distShape.recommendation,
              suggestedThresholds: distShape.suggestedThresholds
            }
            logger.debug('MeasurementPlanner', `${category}: ${distShape.shape} - ${distShape.recommendation}`)
          } catch (err) {
            console.warn(`⚠️ Could not analyze distribution for ${category}:`, err.message)
          }

          if (hasUnsampled) {
            hasAnyUnsampled = true
          }
        }
      })

      setUnsampledAnalysis(analysis)
      setDistributionAdvice(distAdvice)

      // Calculate power analysis for sample size recommendation
      try {
        const powerRec = suggestOptimalSampleSize({
          baselineN: 604,  // You have 604 entries
          desiredEffectSize: 0.5,  // Medium effect
          desiredPower: 0.8,  // 80% power
          maxBudget: 50,  // Can collect up to 50 new points
          minRecommendation: 10
        })
        setPowerAnalysis(powerRec)
        logger.debug('MeasurementPlanner', `📊 Power analysis: Recommend ${powerRec.suggested} points for ${powerRec.achievedPower}% power`)
      } catch (err) {
        console.warn('⚠️ Power analysis calculation failed:', err.message)
      }

      if (!hasAnyUnsampled) {
        logger.warn('MeasurementPlanner', '⚠️ No undersampled value ranges found in any category')
      }
    }

    analyzeUnsampled()
  }, [histogramsByCategory])

  // Calculate priority grid with real raster data
  const handleCalculate = async () => {
    try {
      setError(null)
      setIsCalculating(true)

      console.log('🎯 handleCalculate started')
      console.log('Polygon:', polygon)
      console.log('rasterDataCache keys:', Object.keys(rasterDataCache))
      console.log('unsampledAnalysis keys:', Object.keys(unsampledAnalysis))

      if (!polygon) {
        throw new Error('No study polygon defined. Draw or upload a polygon first.')
      }

      if (Object.keys(unsampledAnalysis).length === 0) {
        throw new Error('No undersampled ranges found in any category')
      }

      if (Object.keys(rasterDataCache).length === 0) {
        throw new Error('No raster data loaded. Upload and analyze rasters first.')
      }

      logger.debug('MeasurementPlanner', '🎯 Starting priority grid calculation with real data')
      console.log('📊 Calling createPriorityGrid with:', { rastersByCategory: Object.keys(rastersByCategory), rasterDataCache: Object.keys(rasterDataCache), histogramsByCategory: Object.keys(histogramsByCategory) })

      // Call the real algorithm
      const result = createPriorityGrid(
        rastersByCategory,
        rasterDataCache,
        histogramsByCategory,
        polygon
      )

      console.log('🎯 createPriorityGrid returned:', result)

      if (result.error) {
        throw new Error(result.error)
      }

      // Generate candidate points from priority grid using the algorithm function
      const priorityGrid = {
        width: result.targetWidth,
        height: result.targetHeight,
        cells: result.priorityScores.map(p => p.sum)  // Extract priority values for heat map
      }
      setPriorityGrid(priorityGrid)  // Store for heat map visualization

      const allCandidates = generatePointsFromGrid(
        priorityGrid,
        result.priorityScores,
        result.alignedOrigin,
        result.targetResolution,
        100  // Request more points, will filter to polygon
      )

      // Filter points to only those inside the polygon
      const polygonCoords = polygon.geometry ? polygon.geometry.coordinates[0] : polygon.coordinates[0]
      const candidates = allCandidates.filter(point =>
        pointInPolygon([point.lon, point.lat], polygonCoords)
      )

      // Analyze zone level distribution
      const distribution = {
        critical: candidates.filter(p => p.zoneLevel === 'critical').length,
        high: candidates.filter(p => p.zoneLevel === 'high').length,
        medium: candidates.filter(p => p.zoneLevel === 'medium').length,
        low: candidates.filter(p => p.zoneLevel === 'low').length
      }

      console.warn(`✅ CANDIDATE POINTS: ${candidates.length}/${allCandidates.length}`)
      console.warn(distribution)
      console.warn({ min: Math.min(...candidates.map(p => p.priority)).toFixed(2), max: Math.max(...candidates.map(p => p.priority)).toFixed(2), avg: (candidates.reduce((sum, p) => sum + p.priority, 0) / candidates.length).toFixed(2) })

      setCandidatePoints(candidates)

      if (onCandidatePointsGenerated) {
        onCandidatePointsGenerated(candidates)
      }

      logger.debug('MeasurementPlanner', `✅ Generated ${candidates.length} candidate points`)
      logger.debug('MeasurementPlanner', `Priority distribution: ${candidates.map(p => p.priority).join(', ').substring(0, 50)}...`)
    } catch (err) {
      console.error('❌ Error:', err)
      logger.error('MeasurementPlanner', 'Calculation error:', err.message)
      setError(err.message)
    } finally {
      setIsCalculating(false)
    }
  }


  // Extract actual raster values from original thematic maps for each candidate point
  const enrichedCandidatePoints = useMemo(() => {
    if (candidatePoints.length === 0 || !rasterDataCache) return candidatePoints

    return candidatePoints.map(point => {
      const enrichedPoint = { ...point, values: {} }

      // Sample each thematic raster at this candidate point location
      Object.entries(CATEGORIES).forEach(([category, catInfo]) => {
        const raster = rasterDataCache[category]
        if (!raster || !raster.geotransform || !raster.pixels) return

        try {
          // Convert lat/lon to pixel coordinates
          const gt = raster.geotransform
          const pixelX = (point.lon - gt[0]) / gt[1]
          const pixelY = (point.lat - gt[3]) / gt[5]

          // Get nearest pixel
          const px = Math.round(pixelX)
          const py = Math.round(pixelY)

          if (px >= 0 && px < raster.width && py >= 0 && py < raster.height) {
            const pixelIdx = py * raster.width + px
            if (pixelIdx >= 0 && pixelIdx < raster.pixels.length) {
              const value = parseFloat(raster.pixels[pixelIdx])
              if (isFinite(value)) {
                enrichedPoint.values[category] = parseFloat(value.toFixed(1))
              }
            }
          }
        } catch (err) {
          logger.debug('MeasurementPlanner', `Error sampling ${category} at [${point.lat}, ${point.lon}]:`, err.message)
        }
      })

      // Recalculate coverage as the count of categories with actual values
      enrichedPoint.coverage = Object.keys(enrichedPoint.values).length

      return enrichedPoint
    })
  }, [candidatePoints, rasterDataCache])

  // Filter candidate points based on thresholds
  const filteredCandidates = useMemo(() => {
    // Map priority threshold to zone levels
    const zoneLevelMap = {
      1: ['critical', 'high', 'medium', 'low'],      // Any (Low)
      2: ['critical', 'high', 'medium'],              // Medium and above
      3: ['critical', 'high'],                        // High and above
      4: ['critical']                                 // Critical only
    }

    const allowedZones = zoneLevelMap[priorityThreshold] || zoneLevelMap[1]

    let filtered = enrichedCandidatePoints.filter(p => {
      // Filter by zone level (Critical/High/Medium/Low)
      const passesZoneFilter = allowedZones.includes(p.zoneLevel)
      return passesZoneFilter
    })

    if (coverageThreshold !== 'all') {
      const threshold = parseInt(coverageThreshold)
      filtered = filtered.filter(p => p.coverage >= threshold)
    }

    return filtered
  }, [enrichedCandidatePoints, priorityThreshold, coverageThreshold])

  return (
    <div style={{
      padding: '20px',
      backgroundColor: 'var(--bg-primary)',
    }}>
      {/* Main Container */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '2px solid #2196F3',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          borderBottom: '2px solid #2196F3',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '18px' }}>
            📍 Planning Next Measurement Points
          </h3>
          {candidatePoints.length > 0 && (
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {filteredCandidates.length}/{candidatePoints.length} points
            </span>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div style={{
            padding: '12px 20px',
            backgroundColor: '#F44336',
            color: 'white',
            borderBottom: '1px solid #D32F2F'
          }}>
            ❌ {error}
          </div>
        )}

        {/* Content */}
        <div style={{ padding: '20px' }}>
          {/* Step 1: Analysis Section */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ marginTop: 0, color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600' }}>
              📊 Step 1: Analysis
            </h4>

            {/* Parameter Coverage Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              {Object.entries(unsampledAnalysis).map(([category, analysis]) => {
                const categoryInfo = CATEGORIES[category]
                if (!categoryInfo) return null
                return (
                  <div
                    key={category}
                    style={{
                      padding: '12px',
                      backgroundColor: 'var(--bg-primary)',
                      border: `2px solid ${categoryInfo.color}`,
                      borderRadius: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        backgroundColor: categoryInfo.color,
                        borderRadius: '2px'
                      }}/>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '12px' }}>{categoryInfo.label}</strong>
                    </div>

                    {analysis.hasUnsampled ? (
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        <div style={{ marginBottom: '8px', padding: '8px', backgroundColor: 'rgba(255, 152, 0, 0.1)', borderRadius: '4px' }}>
                          <strong style={{ color: '#FF9800' }}>Coverage:</strong><br/>
                          <div style={{ marginTop: '3px' }}>
                            🎯 <strong>{analysis.missingPercent?.toFixed(1) || '?'}%</strong> overall<br/>
                            ⚠️ <strong>{analysis.peakMissingPercent?.toFixed(1) || '?'}%</strong> in peaks
                          </div>
                          {analysis.missingPercent > 40 || analysis.peakMissingPercent > 50 ?
                            <div style={{ marginTop: '4px', color: '#FF1744', fontSize: '10px' }}>
                              🔴 CRITICAL
                            </div>
                            : analysis.missingPercent > 30 ?
                            <div style={{ marginTop: '4px', color: '#FF6F00', fontSize: '10px' }}>
                              🟠 HIGH PRIORITY
                            </div>
                            : null
                          }
                        </div>

                        {/* Distribution shape */}
                        {distributionAdvice[category] && (
                          <div style={{ padding: '6px', backgroundColor: 'rgba(33, 150, 243, 0.1)', borderRadius: '4px', fontSize: '10px' }}>
                            <strong style={{ color: '#2196F3' }}>Distribution:</strong> {distributionAdvice[category].shape.toUpperCase()}<br/>
                            <span style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>💡 {distributionAdvice[category].recommendation}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>✓ All values well-sampled</div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Power Analysis & Generate Button */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* Power Analysis */}
              {powerAnalysis && (
                <div style={{
                  padding: '12px',
                  backgroundColor: 'rgba(76, 175, 80, 0.1)',
                  border: '2px solid #4CAF50',
                  borderRadius: '8px'
                }}>
                  <strong style={{ color: '#4CAF50', fontSize: '11px' }}>📊 Sample Size</strong>
                  <div style={{ fontSize: '10px', marginTop: '6px', color: 'var(--text-primary)' }}>
                    <strong>Current:</strong> 604 entries<br/>
                    <strong>Recommend:</strong> {powerAnalysis.suggested} new points<br/>
                    <span style={{ color: 'var(--text-secondary)' }}>Power: {powerAnalysis.achievedPower}%</span>
                  </div>
                </div>
              )}

              {/* Generate Button */}
              <div>
                <button
                  onClick={handleCalculate}
                  disabled={isCalculating || !polygon || Object.keys(unsampledAnalysis).length === 0}
                  style={{
                    width: '100%',
                    height: '100%',
                    padding: '12px 16px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                    opacity: isCalculating || !polygon ? 0.5 : 1,
                    transition: 'background-color 0.2s'
                  }}
                >
                  {isCalculating ? '⏳ Calculating...' : '🎯 Generate Points'}
                </button>
              </div>
            </div>
          </div>

          {/* Step 2: Results Section */}
          {candidatePoints.length > 0 && (
            <div>
              <div style={{
                borderTop: '2px solid #E0E0E0',
                paddingTop: '20px',
                marginBottom: '20px'
              }}>
                <h4 style={{ marginTop: 0, color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600' }}>
                  📊 Step 2: Results
                </h4>

                {/* Map Section */}
                {rgbDataCache && (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h5 style={{ marginTop: 0, marginBottom: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                        🗺️ Map View
                      </h5>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={showHeatMap}
                          onChange={(e) => setShowHeatMap(e.target.checked)}
                          style={{ cursor: 'pointer' }}
                        />
                        <span>🔥 Show priority heat map</span>
                      </label>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                      {showHeatMap ? 'Heat map shows priority (red=critical, green=low)' : 'Yellow → Red stars show candidate points by priority'}
                    </div>
                    <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #ccc', position: 'relative' }}>
                      <RasterViewer
                        rasterData={rgbDataCache}
                        polygon={polygon}
                        onPolygonChange={() => {}}
                        sites={sitesData || []}
                        candidatePoints={candidatePoints}
                        opacity={1}
                        readOnly={true}
                      />
                      {showHeatMap && priorityGrid && (
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                          <PriorityHeatMapViewer
                            priorityGrid={priorityGrid}
                            width={rgbDataCache.width || 800}
                            height={rgbDataCache.height || 600}
                            opacity={heatMapOpacity}
                            onOpacityChange={setHeatMapOpacity}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Analysis Insights */}
                <AnalysisInsights
                  candidatePoints={candidatePoints}
                  unsampledAnalysis={unsampledAnalysis}
                  distributionAdvice={distributionAdvice}
                  powerAnalysis={powerAnalysis}
                />

                {/* Filter & Results Section */}
                <div style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  {/* Filters */}
                  <div style={{ marginBottom: '16px' }}>
                    <h5 style={{ marginTop: 0, marginBottom: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      🔍 Filter Results
                    </h5>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          Priority Level
                        </label>
                        <select
                          value={priorityThreshold}
                          onChange={(e) => setPriorityThreshold(parseInt(e.target.value))}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            borderRadius: '4px',
                            border: '1px solid #ccc',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            fontSize: '11px'
                          }}
                        >
                          <option value={1}>🟢 Low and above</option>
                          <option value={2}>🟡 Medium and above</option>
                          <option value={3}>🟠 High and above</option>
                          <option value={4}>🔴 Critical only</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          Coverage
                        </label>
                        <select
                          value={coverageThreshold}
                          onChange={(e) => setCoverageThreshold(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            borderRadius: '4px',
                            border: '1px solid #ccc',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            fontSize: '11px'
                          }}
                        >
                          <option value="all">All</option>
                          <option value={3}>3+ categories</option>
                          <option value={4}>All 4</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Table */}
                  <div>
                    <div style={{
                      maxHeight: '400px',
                      overflow: 'auto',
                      border: '1px solid #ccc',
                      borderRadius: '6px'
                    }}>
                      <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '11px'
                      }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid #ccc' }}>
                            <th style={{ padding: '6px', textAlign: 'left', color: 'var(--text-secondary)' }}>Priority</th>
                            <th style={{ padding: '6px', textAlign: 'left', color: 'var(--text-secondary)' }}>Lat</th>
                            <th style={{ padding: '6px', textAlign: 'left', color: 'var(--text-secondary)' }}>Lon</th>
                            <th style={{ padding: '4px', textAlign: 'center', backgroundColor: '#2196F3', color: 'white' }}>M</th>
                            <th style={{ padding: '4px', textAlign: 'center', backgroundColor: '#4CAF50', color: 'white' }}>V</th>
                            <th style={{ padding: '4px', textAlign: 'center', backgroundColor: '#FF9800', color: 'white' }}>D</th>
                            <th style={{ padding: '4px', textAlign: 'center', backgroundColor: '#9C27B0', color: 'white' }}>O</th>
                            <th style={{ padding: '6px', textAlign: 'left', color: 'var(--text-secondary)' }}>Cov</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCandidates.map((point, idx) => {
                            let priorityLabel = '🟢 Low'
                            if (point.zoneLevel === 'critical') priorityLabel = '🔴 Crit'
                            else if (point.zoneLevel === 'high') priorityLabel = '🟠 High'
                            else if (point.zoneLevel === 'medium') priorityLabel = '🟡 Mid'
                            return (
                              <tr
                                key={idx}
                                style={{
                                  borderBottom: '1px solid #eee',
                                  backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)'
                                }}
                              >
                                <td style={{ padding: '4px', fontSize: '10px', color: 'var(--text-primary)' }}>
                                  {priorityLabel}
                                </td>
                                <td style={{ padding: '4px', color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '10px' }}>
                                  {point.lat.toFixed(4)}
                                </td>
                                <td style={{ padding: '4px', color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '10px' }}>
                                  {point.lon.toFixed(4)}
                                </td>
                                <td style={{ padding: '2px', textAlign: 'center', color: 'var(--text-primary)', fontSize: '10px' }}>
                                  {point.values?.moisture !== undefined ? point.values.moisture.toFixed(0) : '—'}
                                </td>
                                <td style={{ padding: '2px', textAlign: 'center', color: 'var(--text-primary)', fontSize: '10px' }}>
                                  {point.values?.vegetation !== undefined ? point.values.vegetation.toFixed(0) : '—'}
                                </td>
                                <td style={{ padding: '2px', textAlign: 'center', color: 'var(--text-primary)', fontSize: '10px' }}>
                                  {point.values?.disturbance !== undefined ? point.values.disturbance.toFixed(0) : '—'}
                                </td>
                                <td style={{ padding: '2px', textAlign: 'center', color: 'var(--text-primary)', fontSize: '10px' }}>
                                  {point.values?.other !== undefined ? point.values.other.toFixed(0) : '—'}
                                </td>
                                <td style={{ padding: '4px', color: 'var(--text-secondary)', fontSize: '10px' }}>
                                  {point.coverage}/4
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Export Button */}
                    <div style={{ marginTop: '12px', textAlign: 'center' }}>
                      <button
                        onClick={() => exportToCsv(filteredCandidates)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#2196F3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: '500'
                        }}
                      >
                        📥 Export as CSV
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper function to export points as CSV
function exportToCsv(points) {
  const csv = [['Latitude', 'Longitude', 'Priority', 'Moisture', 'Vegetation', 'Disturbance', 'Other', 'Coverage']
    .concat(
      points.map(p => [
        p.lat.toFixed(6),
        p.lon.toFixed(6),
        p.priority,
        p.values?.moisture?.toFixed(1) || '',
        p.values?.vegetation?.toFixed(1) || '',
        p.values?.disturbance?.toFixed(1) || '',
        p.values?.other?.toFixed(1) || '',
        p.coverage
      ])
    )]
    .map(row => row.join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `measurement_points_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
