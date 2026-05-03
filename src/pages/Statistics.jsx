import { useState, useMemo } from 'react'
import HeterogeneityAnalysis from '../components/HeterogeneityAnalysis'
import LandscapeBarPlot from '../components/LandscapeBarPlot'
import ErrorBoundary from '../components/ErrorBoundary'

export default function Statistics({ setCurrentPage, allEntries }) {
  const [activeTab, setActiveTab] = useState('landscape')
  const [filterByDay, setFilterByDay] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [landscapeColumnName, setLandscapeColumnName] = useState('landscape')

  const filteredEntries = useMemo(() => {
    if (filterByDay) {
      return allEntries.filter(entry => entry.date === selectedDate)
    }
    return allEntries
  }, [allEntries, filterByDay, selectedDate])

  // Get available columns from first entry
  const availableColumns = useMemo(() => {
    if (!allEntries || allEntries.length === 0) return []
    const firstEntry = allEntries[0]
    return Object.keys(firstEntry).sort()
  }, [allEntries])

  const landscapeDistribution = useMemo(() => {
    const distribution = {}
    filteredEntries.forEach(entry => {
      const landscape = entry[landscapeColumnName] || 'Unknown'
      distribution[landscape] = (distribution[landscape] || 0) + 1
    })
    return Object.entries(distribution)
      .sort((a, b) => b[1] - a[1])
      .map(([landscape, count]) => ({
        landscape,
        count,
        percentage: ((count / filteredEntries.length) * 100).toFixed(1)
      }))
  }, [filteredEntries, landscapeColumnName])

  const uniqueDates = useMemo(() => {
    return [...new Set(allEntries.map(e => e.date))].sort().reverse()
  }, [allEntries])

  const maxCount = useMemo(() => {
    return Math.max(...landscapeDistribution.map(d => d.count), 1)
  }, [landscapeDistribution])

  return (
    <div className="page-content">
      <button className="btn-back" onClick={() => setCurrentPage('home')}>← Back to Menu</button>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0 }}>Statistics</h2>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '6px 10px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600'
          }}
        >
          🔄 Recalculate
        </button>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '16px',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '12px'
      }}>
        <button
          onClick={() => setActiveTab('landscape')}
          style={{
            padding: '8px 16px',
            backgroundColor: activeTab === 'landscape' ? 'var(--accent-color)' : 'transparent',
            color: activeTab === 'landscape' ? 'white' : 'var(--text-primary)',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
        >
          📊 Landscape Distribution
        </button>
        <button
          onClick={() => setActiveTab('heterogeneity')}
          style={{
            padding: '8px 16px',
            backgroundColor: activeTab === 'heterogeneity' ? 'var(--accent-color)' : 'transparent',
            color: activeTab === 'heterogeneity' ? 'white' : 'var(--text-primary)',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
        >
          🛰️ Heterogeneity Analysis
        </button>
        <button
          onClick={() => setActiveTab('parameters')}
          style={{
            padding: '8px 16px',
            backgroundColor: activeTab === 'parameters' ? 'var(--accent-color)' : 'transparent',
            color: activeTab === 'parameters' ? 'white' : 'var(--text-primary)',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
        >
          📈 Parameter Distributions
        </button>
      </div>

      {activeTab === 'landscape' && (
        <>
          <div className="stats-controls">
        <div className="control-group">
          <label>Landscape Type Column</label>
          <select
            value={landscapeColumnName}
            onChange={(e) => setLandscapeColumnName(e.target.value)}
          >
            {availableColumns.map(col => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={filterByDay}
              onChange={(e) => setFilterByDay(e.target.checked)}
            />
            Filter by day
          </label>
        </div>

        {filterByDay && (
          <div className="control-group">
            <label>Select Date</label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            >
              {uniqueDates.map(date => (
                <option key={date} value={date}>
                  {date}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="section">
        <h3>Measurements: {filteredEntries.length}</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
          {filterByDay ? `Data for ${selectedDate}` : 'All data'}
        </p>

        {filteredEntries.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No measurements recorded yet.</p>
        ) : (
          <LandscapeBarPlot data={landscapeDistribution} />
        )}
      </div>

          <div className="section info-section">
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              More statistics coming soon...
            </p>
          </div>
        </>
      )}

      {activeTab === 'heterogeneity' && (
        <ErrorBoundary>
          <HeterogeneityAnalysis allEntries={allEntries} />
        </ErrorBoundary>
      )}

      {activeTab === 'parameters' && (
        <ParameterDistributions entries={filteredEntries} />
      )}
    </div>
  )
}

// Normal distribution PDF
function normalPDF(x, mean, std) {
  const coefficient = 1 / (std * Math.sqrt(2 * Math.PI))
  const exponent = -Math.pow(x - mean, 2) / (2 * Math.pow(std, 2))
  return coefficient * Math.exp(exponent)
}

function ParameterDistributions({ entries }) {
  const calculateStats = (values) => {
    // Convert to numbers and filter valid values
    const numericValues = values.map(v => {
      if (v === null || v === undefined) return null
      const num = parseFloat(v)
      return isFinite(num) ? num : null
    }).filter(v => v !== null)

    if (numericValues.length === 0) return null

    const mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length
    const variance = numericValues.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / numericValues.length
    const std = Math.sqrt(variance)

    return {
      min: Math.min(...numericValues),
      max: Math.max(...numericValues),
      mean: isFinite(mean) ? mean : null,
      std: isFinite(std) ? std : null,
      count: numericValues.length
    }
  }

  const ParameterHistogram = ({ values, label, unit, color }) => {
    const stats = calculateStats(values)
    if (!stats) {
      return (
        <div className="section">
          <h4>{label}</h4>
          <p style={{ color: 'var(--text-secondary)' }}>No data available</p>
        </div>
      )
    }

    // Responsive SVG size
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
    const SVG_WIDTH = isMobile ? 320 : 480
    const SVG_HEIGHT = isMobile ? 220 : 280
    const PADDING = isMobile ? { top: 15, right: 15, bottom: 30, left: 40 } : { top: 20, right: 20, bottom: 40, left: 50 }
    const CHART_WIDTH = SVG_WIDTH - PADDING.left - PADDING.right
    const CHART_HEIGHT = SVG_HEIGHT - PADDING.top - PADDING.bottom

    const minVal = stats.min - stats.std
    const maxVal = stats.max + stats.std
    const range = maxVal - minVal

    // Generate smooth curve
    const curvePoints = 100
    const step = range / curvePoints
    const curveData = []

    for (let i = 0; i <= curvePoints; i++) {
      const x = minVal + i * step
      const y = normalPDF(x, stats.mean, stats.std)
      curveData.push({ x, y })
    }

    const maxDensity = Math.max(...curveData.map(p => p.y), 0.001)

    const xScale = (val) => PADDING.left + ((val - minVal) / range) * CHART_WIDTH
    const yScale = (density) => SVG_HEIGHT - PADDING.bottom - (density / maxDensity) * CHART_HEIGHT

    // Create path for curve
    const curvePath = curveData
      .map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${xScale(point.x)} ${yScale(point.y)}`)
      .join(' ')

    // Create filled area path
    const baseline = SVG_HEIGHT - PADDING.bottom
    let areaPath = `M ${xScale(curveData[0].x)} ${baseline}`
    curveData.forEach((point) => {
      areaPath += ` L ${xScale(point.x)} ${yScale(point.y)}`
    })
    areaPath += ` L ${xScale(curveData[curveData.length - 1].x)} ${baseline} Z`

    return (
      <div className="section" style={{ flex: 1 }}>
        <h4 style={{ marginBottom: '12px' }}>{label}</h4>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          {/* Histogram */}
          <div style={{ flex: 1, overflowX: 'auto', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px' }}>
            <svg width={SVG_WIDTH} height={SVG_HEIGHT} style={{ minWidth: '100%', display: 'block' }}>
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
                <line
                  key={`grid-${tick}`}
                  x1={xScale(minVal + range * tick)}
                  y1={PADDING.top}
                  x2={xScale(minVal + range * tick)}
                  y2={SVG_HEIGHT - PADDING.bottom}
                  stroke="var(--border-color)"
                  strokeDasharray="2,2"
                  opacity="0.4"
                />
              ))}

              {/* Filled area */}
              <path d={areaPath} fill={color} opacity="0.25" />

              {/* Curve */}
              <path d={curvePath} stroke={color} strokeWidth="2.5" fill="none" opacity="0.8" />

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

              {/* X-axis labels */}
              {[0, 0.2, 0.4, 0.6, 0.8, 1].map((tick) => {
                const val = minVal + range * tick
                return (
                  <g key={`x-label-${tick}`}>
                    <line
                      x1={xScale(val)}
                      y1={SVG_HEIGHT - PADDING.bottom}
                      x2={xScale(val)}
                      y2={SVG_HEIGHT - PADDING.bottom + 4}
                      stroke="var(--text-primary)"
                      strokeWidth="1"
                    />
                    <text
                      x={xScale(val)}
                      y={SVG_HEIGHT - PADDING.bottom + 18}
                      textAnchor="middle"
                      fontSize="10"
                      fill="var(--text-secondary)"
                    >
                      {val.toFixed(1)}
                    </text>
                  </g>
                )
              })}

              {/* Y-axis label */}
              <text
                x={15}
                y={PADDING.top + 20}
                fontSize="11"
                fill="var(--text-secondary)"
                textAnchor="middle"
              >
                Density
              </text>
            </svg>
          </div>

          {/* Stats box */}
          <div style={{
            backgroundColor: 'rgba(76, 175, 80, 0.08)',
            borderLeft: '4px solid #4CAF50',
            padding: '12px 14px',
            borderRadius: '4px',
            minWidth: '160px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div>
              <div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '3px', fontWeight: '600' }}>Mean</div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
                {isFinite(stats.mean) ? `${stats.mean.toFixed(1)}${unit}` : 'N/A'}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Std: {isFinite(stats.std) ? stats.std.toFixed(2) : 'N/A'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '3px', fontWeight: '600' }}>Range</div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                [{stats.min.toFixed(1)}, {stats.max.toFixed(1)}]
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                n={stats.count}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '3px', fontWeight: '600' }}>Coverage</div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
                {((stats.count / entries.length) * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const soilMoistureValues = entries.map(e => e.soilMoisture).filter(v => v !== undefined && v !== null)
  const soilTempValues = entries.map(e => e.soilTemperature).filter(v => v !== undefined && v !== null)

  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '16px'
      }}>
        <ParameterHistogram
          values={soilMoistureValues}
          label="🌧️ Soil Moisture Distribution"
          unit="%"
          color="#2196F3"
        />
        <ParameterHistogram
          values={soilTempValues}
          label="🌡️ Soil Temperature Distribution"
          unit="°C"
          color="#FF6B6B"
        />
      </div>
    </div>
  )
}
