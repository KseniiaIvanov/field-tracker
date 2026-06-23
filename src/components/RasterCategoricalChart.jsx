import { memo } from 'react'

// Grouped bar chart comparing land-cover class proportions at sites vs across
// the whole study area. Built for CATEGORICAL rasters (class codes), where a
// histogram/normal curve would be meaningless.
function RasterCategoricalChart({ siteDist, areaDist, coverage, classLabels = {} }) {
  if (!siteDist || !areaDist || !areaDist.classes || areaDist.classes.length === 0) {
    return <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>No data to display</div>
  }

  const siteProp = new Map((siteDist.classes || []).map(c => [c.code, c.proportion]))
  const areaProp = new Map(areaDist.classes.map(c => [c.code, c.proportion]))

  // Union of all class codes, sorted, so every area class is shown even if unsampled
  const codes = Array.from(new Set([...siteProp.keys(), ...areaProp.keys()])).sort((a, b) => a - b)
  const maxProp = Math.max(0.01, ...codes.map(c => Math.max(siteProp.get(c) || 0, areaProp.get(c) || 0)))

  return (
    <div className="categorical-comparison">
      {/* Legend */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '24px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '16px', height: '12px', backgroundColor: '#2196F3', opacity: 0.7 }}></div>
            Sites (n={siteDist.stats?.count ?? 0})
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '16px', height: '12px', backgroundColor: '#FF5722', opacity: 0.7 }}></div>
            Polygon (n={areaDist.stats?.count ?? 0})
          </label>
        </div>
      </div>

      {/* Bars */}
      <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px 16px', marginBottom: '6px' }}>
        {codes.map(code => {
          const sp = siteProp.get(code) || 0
          const ap = areaProp.get(code) || 0
          const label = classLabels[code] || `Class ${code}`
          const unsampled = !siteProp.has(code)
          return (
            <div key={code} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-primary)', marginBottom: '3px' }}>
                <span style={{ fontWeight: '600' }}>{label}{unsampled ? ' ⚠️' : ''}</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  site {(sp * 100).toFixed(0)}% / area {(ap * 100).toFixed(0)}%
                </span>
              </div>
              {/* Site bar */}
              <div style={{ height: '9px', backgroundColor: 'var(--bg-primary)', borderRadius: '3px', overflow: 'hidden', marginBottom: '2px' }}>
                <div style={{ width: `${(sp / maxProp) * 100}%`, height: '100%', backgroundColor: '#2196F3', opacity: 0.75 }} />
              </div>
              {/* Area bar */}
              <div style={{ height: '9px', backgroundColor: 'var(--bg-primary)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${(ap / maxProp) * 100}%`, height: '100%', backgroundColor: '#FF5722', opacity: 0.75 }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Coverage assessment */}
      {coverage && (
        <div style={{
          padding: '8px 10px',
          backgroundColor: getCoverageColor(coverage.assessment),
          borderRadius: '8px',
          borderLeft: `4px solid ${getAssessmentBorderColor(coverage.assessment)}`,
          marginBottom: '16px'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: '600', whiteSpace: 'nowrap' }}>OVERLAP</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>{coverage.overlapCoefficient}%</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: '600', whiteSpace: 'nowrap' }}>CLASSES SAMPLED</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>{coverage.classesSampled}/{coverage.classesTotal}</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: '600' }}>ASSESSMENT</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>{coverage.assessment}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getCoverageColor(assessment) {
  switch (assessment) {
    case 'Excellent': return 'rgba(45, 106, 79, 0.1)'
    case 'Good': return 'rgba(56, 142, 60, 0.1)'
    case 'Partial': return 'rgba(251, 188, 5, 0.1)'
    case 'Poor': return 'rgba(211, 47, 47, 0.1)'
    default: return 'rgba(0, 0, 0, 0.05)'
  }
}

function getAssessmentBorderColor(assessment) {
  switch (assessment) {
    case 'Excellent': return '#2d6a4f'
    case 'Good': return '#388e3c'
    case 'Partial': return '#fbc005'
    case 'Poor': return '#d32f2f'
    default: return '#999'
  }
}

export default memo(RasterCategoricalChart)
