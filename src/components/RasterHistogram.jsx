import { useMemo, memo } from 'react'

// Normal distribution PDF
function normalPDF(x, mean, std) {
  const coefficient = 1 / (std * Math.sqrt(2 * Math.PI))
  const exponent = -Math.pow(x - mean, 2) / (2 * Math.pow(std, 2))
  return coefficient * Math.exp(exponent)
}

function RasterHistogram({ siteStats, areaStats, coverage, columnCount = 1 }) {
  // Responsive width: scale down based on how many charts are displayed
  // Start with 800px for single chart, reduce proportionally for multiple
  const baseWidth = 800
  const SVG_WIDTH = Math.max(300, Math.floor(baseWidth / columnCount))
  const SVG_HEIGHT = 300

  // Responsive padding: scale down for smaller charts
  const scaleFactor = SVG_WIDTH / baseWidth
  const PADDING = {
    top: Math.max(15, Math.floor(30 * scaleFactor)),
    right: Math.max(10, Math.floor(20 * scaleFactor)),
    bottom: Math.max(30, Math.floor(50 * scaleFactor)),
    left: Math.max(30, Math.floor(50 * scaleFactor))
  }

  const CHART_WIDTH = SVG_WIDTH - PADDING.left - PADDING.right
  const CHART_HEIGHT = SVG_HEIGHT - PADDING.top - PADDING.bottom

  // Responsive font size based on chart scale
  const fontSize = Math.max(8, Math.floor(11 * scaleFactor))

  const maxDensity = useMemo(() => {
    // Use density for Y-axis (normalized by sample size)
    // This makes distributions comparable regardless of number of measurements
    const siteDensities = siteStats?.bins?.map(b => b.density) || [0]
    const areaDensities = areaStats?.bins?.map(b => b.density) || [0]
    return Math.max(...siteDensities, ...areaDensities, 0.001)
  }, [siteStats, areaStats])

  if (!siteStats || !areaStats) {
    return <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>No data to display</div>
  }

  // Generate distribution curve points for both site and area
  const minVal = Math.min(siteStats.stats.min, areaStats.stats.min)
  const maxVal = Math.max(siteStats.stats.max, areaStats.stats.max)
  const curvePoints = 100
  const step = (maxVal - minVal) / curvePoints

  const siteCurveData = useMemo(() => {
    const points = []
    const mean = parseFloat(siteStats.stats.mean)
    const std = parseFloat(siteStats.stats.std)

    for (let i = 0; i <= curvePoints; i++) {
      const x = minVal + i * step
      const pdfValue = normalPDF(x, mean, std)
      // Use PDF directly as density (normalized probability distribution)
      points.push({ x, y: pdfValue })
    }
    return points
  }, [siteStats, minVal, step])

  const areaCurveData = useMemo(() => {
    const points = []
    const mean = parseFloat(areaStats.stats.mean)
    const std = parseFloat(areaStats.stats.std)

    for (let i = 0; i <= curvePoints; i++) {
      const x = minVal + i * step
      const pdfValue = normalPDF(x, mean, std)
      // Use PDF directly as density (normalized probability distribution)
      points.push({ x, y: pdfValue })
    }
    return points
  }, [areaStats, minVal, step])

  // Scale functions
  const xScale = useMemo(() => {
    return (value) => PADDING.left + ((value - minVal) / (maxVal - minVal)) * CHART_WIDTH
  }, [minVal, maxVal])

  const yScale = useMemo(() => {
    return (density) => SVG_HEIGHT - PADDING.bottom - ((density || 0) / maxDensity) * CHART_HEIGHT
  }, [maxDensity])

  // Create path for distribution curves with memoization
  const siteCurvePath = useMemo(() => {
    return siteCurveData
      .map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${xScale(point.x)} ${yScale(point.y)}`)
      .join(' ')
  }, [siteCurveData, xScale, yScale])

  const areaCurvePath = useMemo(() => {
    return areaCurveData
      .map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${xScale(point.x)} ${yScale(point.y)}`)
      .join(' ')
  }, [areaCurveData, xScale, yScale])

  // Create filled area paths (with 40% opacity)
  const siteAreaPath = useMemo(() => {
    const baseline = SVG_HEIGHT - PADDING.bottom
    let path = `M ${xScale(siteCurveData[0].x)} ${baseline}`
    siteCurveData.forEach((point, idx) => {
      path += ` L ${xScale(point.x)} ${yScale(point.y)}`
    })
    path += ` L ${xScale(siteCurveData[siteCurveData.length - 1].x)} ${baseline} Z`
    return path
  }, [siteCurveData, xScale, yScale])

  const areaAreaPath = useMemo(() => {
    const baseline = SVG_HEIGHT - PADDING.bottom
    let path = `M ${xScale(areaCurveData[0].x)} ${baseline}`
    areaCurveData.forEach((point, idx) => {
      path += ` L ${xScale(point.x)} ${yScale(point.y)}`
    })
    path += ` L ${xScale(areaCurveData[areaCurveData.length - 1].x)} ${baseline} Z`
    return path
  }, [areaCurveData, xScale, yScale])

  const binWidth = CHART_WIDTH / siteStats.bins.length

  return (
    <div className="histogram-comparison">
      {/* Main Overlaid Histogram */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ marginBottom: '12px' }}>
          <h4 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>
            📊 Distribution Comparison
          </h4>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '24px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '16px', height: '12px', backgroundColor: '#2196F3', opacity: 0.6 }}></div>
              Values at Sites (n={siteStats.stats.count})
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '16px', height: '12px', backgroundColor: '#FF5722', opacity: 0.6 }}></div>
              Values in Study Area (n={areaStats.stats.count})
            </label>
          </div>
        </div>

        <div style={{ overflowX: 'auto', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', padding: '16px' }}>
          <svg width={SVG_WIDTH} height={SVG_HEIGHT} style={{ minWidth: '100%', display: 'block' }}>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
              <line
                key={`grid-${tick}`}
                x1={xScale(minVal + (maxVal - minVal) * tick)}
                y1={PADDING.top}
                x2={xScale(minVal + (maxVal - minVal) * tick)}
                y2={SVG_HEIGHT - PADDING.bottom}
                stroke="var(--border-color)"
                strokeDasharray="2,2"
                opacity="0.5"
              />
            ))}

            {/* Site distribution shaded area (25% opacity) */}
            <path
              d={siteAreaPath}
              fill="#2196F3"
              opacity="0.25"
            />

            {/* Area distribution shaded area (25% opacity) */}
            <path
              d={areaAreaPath}
              fill="#FF5722"
              opacity="0.25"
            />

            {/* Site distribution curve */}
            <path
              d={siteCurvePath}
              stroke="#2196F3"
              strokeWidth="2.5"
              fill="none"
              opacity="0.8"
            />

            {/* Area distribution curve */}
            <path
              d={areaCurvePath}
              stroke="#FF5722"
              strokeWidth="2.5"
              fill="none"
              opacity="0.8"
            />

            {/* X-axis */}
            <line
              x1={PADDING.left}
              y1={SVG_HEIGHT - PADDING.bottom}
              x2={SVG_WIDTH - PADDING.right}
              y2={SVG_HEIGHT - PADDING.bottom}
              stroke="var(--text-primary)"
              strokeWidth="1.5"
            />

            {/* Y-axis */}
            <line
              x1={PADDING.left}
              y1={PADDING.top}
              x2={PADDING.left}
              y2={SVG_HEIGHT - PADDING.bottom}
              stroke="var(--text-primary)"
              strokeWidth="1.5"
            />

            {/* X-axis ticks and labels */}
            {[0, 0.2, 0.4, 0.6, 0.8, 1].map((tick) => {
              const value = minVal + (maxVal - minVal) * tick
              const x = xScale(value)
              return (
                <g key={`x-tick-${tick}`}>
                  <line x1={x} y1={SVG_HEIGHT - PADDING.bottom} x2={x} y2={SVG_HEIGHT - PADDING.bottom + 5} stroke="var(--text-primary)" />
                  <text
                    x={x}
                    y={SVG_HEIGHT - PADDING.bottom + 20}
                    textAnchor="middle"
                    fontSize={fontSize}
                    fill="var(--text-secondary)"
                  >
                    {value.toFixed(2)}
                  </text>
                </g>
              )
            })}

            {/* Y-axis ticks and labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
              const density = maxDensity * tick
              const y = yScale(density)
              return (
                <g key={`y-tick-${tick}`}>
                  <line x1={PADDING.left - 5} y1={y} x2={PADDING.left} y2={y} stroke="var(--text-primary)" />
                  <text
                    x={PADDING.left - 10}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill="var(--text-secondary)"
                  >
                    {density.toFixed(3)}
                  </text>
                </g>
              )
            })}

            {/* Axis labels */}
            <text
              x={PADDING.left + CHART_WIDTH / 2}
              y={SVG_HEIGHT - 10}
              textAnchor="middle"
              fontSize={Math.max(9, Math.floor(12 * scaleFactor))}
              fill="var(--text-secondary)"
              fontWeight="500"
            >
              Index Value
            </text>
            <text
              x={20}
              y={PADDING.top + CHART_HEIGHT / 2}
              textAnchor="middle"
              fontSize={Math.max(9, Math.floor(12 * scaleFactor))}
              fill="var(--text-secondary)"
              fontWeight="500"
              transform={`rotate(-90 20 ${PADDING.top + CHART_HEIGHT / 2})`}
            >
              Density
            </text>
          </svg>
        </div>
      </div>

      {/* Coverage Assessment - Compact */}
      {coverage && (
        <div className="coverage-assessment" style={{
          padding: '12px',
          backgroundColor: getCoverageColor(coverage.assessment),
          borderRadius: '8px',
          borderLeft: `4px solid ${getAssessmentBorderColor(coverage.assessment)}`,
          marginBottom: '24px'
        }}>
          {/* Main metric: Distribution Match */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '8px' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px', fontWeight: '600' }}>
                DISTRIBUTION MATCH
              </div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>
                {coverage.distributionMatch}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px', fontWeight: '600' }}>
                RANGE COVERAGE
              </div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>
                {coverage.rangeCoverage}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px', fontWeight: '600' }}>
                ASSESSMENT
              </div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>
                {coverage.assessment}
              </div>
            </div>
          </div>

          {/* Compact details */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '12px',
            padding: '8px 0',
            fontSize: '9px',
            color: 'var(--text-secondary)',
            lineHeight: '1.2'
          }}>
            <div>
              <div>Mean: {coverage.meanMatch}%</div>
              <div>Std: {coverage.stdMatch}%</div>
            </div>
            <div>
              <div>Site: {coverage.siteRange}</div>
              <div>Area: {coverage.areaRange}</div>
            </div>
            <div>
              <div>μ diff: {coverage.meanDiff}</div>
              <div>σ diff: {coverage.stdDiff}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getCoverageColor(assessment) {
  switch (assessment) {
    case 'Excellent':
      return 'rgba(45, 106, 79, 0.1)'
    case 'Good':
      return 'rgba(56, 142, 60, 0.1)'
    case 'Partial':
      return 'rgba(251, 188, 5, 0.1)'
    case 'Poor':
      return 'rgba(211, 47, 47, 0.1)'
    default:
      return 'rgba(0, 0, 0, 0.05)'
  }
}

function getAssessmentBorderColor(assessment) {
  switch (assessment) {
    case 'Excellent':
      return '#2d6a4f'
    case 'Good':
      return '#388e3c'
    case 'Partial':
      return '#fbc005'
    case 'Poor':
      return '#d32f2f'
    default:
      return '#999'
  }
}

function getCoverageMessage(assessment) {
  const messages = {
    'Excellent': '✓ Your sites excellently represent the variation in the study area. Heterogeneity is well-captured.',
    'Good': '✓ Your sites well represent the variation. Sampling coverage is adequate.',
    'Partial': '⚠ Your sites partially represent the variation. Consider additional sampling in underrepresented areas.',
    'Poor': '✗ Your sites poorly represent the variation. Additional strategic sampling recommended.'
  }
  return messages[assessment] || 'Unable to assess coverage'
}

export default memo(RasterHistogram)
