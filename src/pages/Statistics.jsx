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

const PARAMETERS = [
  { key: 'landscape',              label: 'Landscape',         type: 'categorical' },
  { key: 'disturbance',            label: 'Disturbance',       type: 'categorical' },
  { key: 'soilMoisture',           label: 'Soil Moisture',     type: 'categorical' },
  { key: 'terrestrialAquatic',     label: 'Environment',       type: 'categorical' },
  { key: 'organicMatterType',      label: 'Organic Matter',    type: 'categorical' },
  { key: 'standingWater',          label: 'Standing Water',    type: 'boolean' },
  { key: 'carbonFluxMeasurement',  label: 'Carbon Flux',       type: 'boolean' },
  { key: 'weather.cloudCover',     label: 'Cloud Cover',       type: 'numeric', unit: '%',   bins: 10 },
  { key: 'weather.temperature',    label: 'Air Temperature',   type: 'numeric', unit: '°C',  bins: 8  },
  { key: 'weather.windSpeed',      label: 'Wind Speed',        type: 'numeric', unit: 'm/s', bins: 7  },
  { key: 'activeLayerDepth',       label: 'AL Depth',          type: 'numeric', unit: 'cm',  bins: 8  },
  { key: 'soilTemperature',        label: 'Soil Temperature',  type: 'numeric', unit: '°C',  bins: 8  },
]

function getNestedValue(obj, key) {
  return key.split('.').reduce((o, k) => o?.[k], obj)
}

function ParameterDistributions({ entries }) {
  const [selectedKey, setSelectedKey] = useState('landscape')
  const param = PARAMETERS.find(p => p.key === selectedKey) || PARAMETERS[0]

  const chartData = useMemo(() => {
    if (!entries.length) return null

    if (param.type === 'boolean') {
      const yes = entries.filter(e => getNestedValue(e, param.key)).length
      const no = entries.length - yes
      return { type: 'categorical', bars: [{ label: 'Yes', count: yes }, { label: 'No', count: no }] }
    }

    if (param.type === 'categorical') {
      const counts = {}
      entries.forEach(e => {
        const val = String(getNestedValue(e, param.key) ?? '').trim() || '—'
        counts[val] = (counts[val] || 0) + 1
      })
      const bars = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ label, count }))
      return { type: 'categorical', bars }
    }

    // numeric
    const raw = entries
      .map(e => parseFloat(getNestedValue(e, param.key)))
      .filter(v => isFinite(v))
    if (!raw.length) return null

    const min = Math.min(...raw)
    const max = Math.max(...raw)
    const mean = raw.reduce((a, b) => a + b, 0) / raw.length
    const std = Math.sqrt(raw.reduce((s, v) => s + (v - mean) ** 2, 0) / raw.length)
    const binCount = param.bins || 8
    const binSize = (max - min) / binCount || 1
    const bins = Array.from({ length: binCount }, (_, i) => ({
      label: (min + i * binSize).toFixed(1),
      count: 0,
      from: min + i * binSize,
      to: min + (i + 1) * binSize
    }))
    raw.forEach(v => {
      const idx = Math.min(Math.floor((v - min) / binSize), binCount - 1)
      bins[idx].count++
    })
    return { type: 'numeric', bars: bins, mean, std, min, max, n: raw.length, unit: param.unit }
  }, [entries, selectedKey])

  const BAR_COLOR = '#4a90d9'
  const W = 340
  const H = 200
  const PAD = { top: 12, right: 12, bottom: 48, left: 36 }
  const CW = W - PAD.left - PAD.right
  const CH = H - PAD.top - PAD.bottom

  const renderChart = () => {
    if (!chartData) return <p style={{ color: 'var(--text-secondary)', padding: '16px 0' }}>No data for this parameter yet.</p>

    const bars = chartData.bars
    const maxCount = Math.max(...bars.map(b => b.count), 1)
    const barW = CW / bars.length
    const gap = Math.max(2, barW * 0.15)

    return (
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', maxWidth: '100%' }}>
        {/* Y gridlines */}
        {[0.25, 0.5, 0.75, 1].map(t => (
          <line key={t}
            x1={PAD.left} y1={PAD.top + CH * (1 - t)}
            x2={PAD.left + CW} y2={PAD.top + CH * (1 - t)}
            stroke="#ddd" strokeWidth="0.5" />
        ))}

        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + CH} stroke="#999" strokeWidth="1" />
        <line x1={PAD.left} y1={PAD.top + CH} x2={PAD.left + CW} y2={PAD.top + CH} stroke="#999" strokeWidth="1" />

        {/* Y labels */}
        {[0, Math.round(maxCount / 2), maxCount].map(v => (
          <text key={v} x={PAD.left - 4} y={PAD.top + CH - (v / maxCount) * CH + 3}
            textAnchor="end" fontSize="9" fill="#888">{v}</text>
        ))}

        {/* Bars */}
        {bars.map((bar, i) => {
          const bh = (bar.count / maxCount) * CH
          const bx = PAD.left + i * barW + gap / 2
          const by = PAD.top + CH - bh
          const bw = barW - gap
          const labelX = bx + bw / 2
          const maxLabelLen = Math.floor(bw / 5.5)
          const label = bar.label.length > maxLabelLen ? bar.label.slice(0, maxLabelLen - 1) + '…' : bar.label

          return (
            <g key={i}>
              <rect x={bx} y={by} width={bw} height={bh || 1}
                fill={BAR_COLOR} rx="2" opacity="0.85" />
              {bar.count > 0 && (
                <text x={labelX} y={by - 3} textAnchor="middle" fontSize="9" fill="#555" fontWeight="600">
                  {bar.count}
                </text>
              )}
              <text x={labelX} y={PAD.top + CH + 13} textAnchor="middle" fontSize="8.5" fill="#666">
                {label}
              </text>
              {chartData.type === 'numeric' && (
                <text x={labelX} y={PAD.top + CH + 24} textAnchor="middle" fontSize="7.5" fill="#aaa">
                  {bar.label}
                </text>
              )}
            </g>
          )
        })}

        {/* Mean line for numeric */}
        {chartData.type === 'numeric' && (() => {
          const mx = PAD.left + ((chartData.mean - chartData.min) / (chartData.max - chartData.min || 1)) * CW
          return (
            <line x1={mx} y1={PAD.top} x2={mx} y2={PAD.top + CH}
              stroke="#e74c3c" strokeWidth="1.5" strokeDasharray="4,3" />
          )
        })()}
      </svg>
    )
  }

  return (
    <div style={{ marginTop: '8px' }}>
      {/* Parameter selector */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
        {PARAMETERS.map(p => (
          <button key={p.key} onClick={() => setSelectedKey(p.key)}
            style={{
              padding: '5px 12px', fontSize: '12px', fontWeight: '600', borderRadius: '16px', border: 'none', cursor: 'pointer',
              backgroundColor: selectedKey === p.key ? BAR_COLOR : 'var(--bg-secondary)',
              color: selectedKey === p.key ? 'white' : 'var(--text-primary)'
            }}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
          <h4 style={{ margin: 0, fontSize: '15px' }}>{param.label}</h4>
          {chartData?.type === 'numeric' && (
            <span style={{ fontSize: '12px', color: '#888' }}>
              n={chartData.n} · mean={chartData.mean.toFixed(1)}{param.unit} · σ={chartData.std.toFixed(1)}
            </span>
          )}
          {chartData?.type === 'categorical' && (
            <span style={{ fontSize: '12px', color: '#888' }}>
              n={entries.length} · {chartData.bars.length} categories
            </span>
          )}
        </div>

        {renderChart()}

        {chartData?.type === 'numeric' && (
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '12px', color: '#888' }}>
            <span>min: {chartData.min.toFixed(1)}{param.unit}</span>
            <span>max: {chartData.max.toFixed(1)}{param.unit}</span>
            <span style={{ color: '#e74c3c' }}>— mean</span>
          </div>
        )}
      </div>
    </div>
  )
}
