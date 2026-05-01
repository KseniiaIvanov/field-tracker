import { memo } from 'react'

function MultiCategoryAnalysis({ analysisResults, categorySettings, analysisLayerSelection, categoryLabels }) {
  if (!analysisResults || Object.keys(analysisResults).length === 0) {
    return (
      <div style={{
        padding: '16px',
        backgroundColor: 'rgba(33, 150, 243, 0.05)',
        borderRadius: '8px',
        color: 'var(--text-secondary)',
        fontSize: '12px',
        marginBottom: '24px'
      }}>
        📊 Analysis results will appear here once you draw/upload a polygon
      </div>
    )
  }

  // Calculate summary statistics only for selected layers
  const summaryData = Object.entries(analysisResults)
    .filter(([category]) => analysisLayerSelection?.[category] !== false) // Include by default unless explicitly false
    .map(([category, result]) => ({
      category,
      label: categoryLabels[category] || category,
      coverage: result.coverage?.coverage || 0,
      assessment: result.coverage?.assessment || 'Unknown',
      sitesAnalyzed: result.sitesAnalyzed || 0,
      pixelsInArea: result.areaPixelsCount || 0
    }))

  // If no layers selected for display, show message
  if (summaryData.length === 0) {
    return (
      <div style={{
        padding: '16px',
        backgroundColor: 'rgba(33, 150, 243, 0.05)',
        borderRadius: '8px',
        color: 'var(--text-secondary)',
        fontSize: '12px'
      }}>
        Select layers on the left to view comparative statistics
      </div>
    )
  }

  // Sort by coverage percentage (best first)
  const sorted = [...summaryData].sort((a, b) => b.coverage - a.coverage)

  // Find problems
  const poorCoverage = summaryData.filter(s => s.assessment === 'Poor')
  const partialCoverage = summaryData.filter(s => s.assessment === 'Partial')
  const averageCoverage = (summaryData.reduce((sum, s) => sum + s.coverage, 0) / summaryData.length).toFixed(1)

  const getAssessmentColor = (assessment) => {
    switch (assessment) {
      case 'Excellent': return '#2d6a4f'
      case 'Good': return '#388e3c'
      case 'Partial': return '#fbc005'
      case 'Poor': return '#d32f2f'
      default: return '#999'
    }
  }

  const getAssessmentBg = (assessment) => {
    switch (assessment) {
      case 'Excellent': return 'rgba(45, 106, 79, 0.1)'
      case 'Good': return 'rgba(56, 142, 60, 0.1)'
      case 'Partial': return 'rgba(251, 188, 5, 0.1)'
      case 'Poor': return 'rgba(211, 47, 47, 0.1)'
      default: return 'rgba(0, 0, 0, 0.05)'
    }
  }

  return (
    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
      <h4 style={{ marginBottom: '16px', color: 'var(--text-primary)', fontSize: '14px' }}>
        📊 Overall Comparative Statistics
      </h4>

      {/* Overview Table */}
      <div style={{
        overflowX: 'auto',
        marginBottom: '24px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '8px',
        padding: '16px'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '12px'
        }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
              <th style={{ textAlign: 'left', padding: '8px', color: 'var(--text-primary)' }}>Variable</th>
              <th style={{ textAlign: 'center', padding: '8px', color: 'var(--text-primary)' }}>Coverage %</th>
              <th style={{ textAlign: 'center', padding: '8px', color: 'var(--text-primary)' }}>Assessment</th>
              <th style={{ textAlign: 'center', padding: '8px', color: 'var(--text-primary)' }}>Sites</th>
              <th style={{ textAlign: 'center', padding: '8px', color: 'var(--text-primary)' }}>Pixels</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.category} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '8px', color: 'var(--text-primary)', fontWeight: '600' }}>
                  {row.label}
                </td>
                <td style={{ textAlign: 'center', padding: '8px', color: 'var(--text-primary)' }}>
                  <strong>{row.coverage}%</strong>
                </td>
                <td style={{
                  textAlign: 'center',
                  padding: '8px',
                  backgroundColor: getAssessmentBg(row.assessment),
                  color: getAssessmentColor(row.assessment),
                  fontWeight: '600',
                  borderRadius: '4px'
                }}>
                  {row.assessment}
                </td>
                <td style={{ textAlign: 'center', padding: '8px', color: 'var(--text-primary)' }}>
                  {row.sitesAnalyzed}
                </td>
                <td style={{ textAlign: 'center', padding: '8px', color: 'var(--text-secondary)' }}>
                  {(row.pixelsInArea / 1000).toFixed(0)}k
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Key Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        marginBottom: '24px'
      }}>
        <div style={{
          padding: '12px',
          backgroundColor: 'rgba(33, 150, 243, 0.05)',
          borderLeft: '4px solid #2196F3',
          borderRadius: '4px'
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            Best Coverage
          </div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
            {sorted[0]?.label}
          </div>
          <div style={{ fontSize: '12px', color: '#2196F3', fontWeight: '600' }}>
            {sorted[0]?.coverage}%
          </div>
        </div>

        <div style={{
          padding: '12px',
          backgroundColor: 'rgba(255, 87, 34, 0.05)',
          borderLeft: '4px solid #FF5722',
          borderRadius: '4px'
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            Average Coverage
          </div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
            {averageCoverage}%
          </div>
          <div style={{ fontSize: '12px', color: '#FF5722', fontWeight: '600' }}>
            across all variables
          </div>
        </div>

        {sorted[sorted.length - 1]?.coverage < sorted[0]?.coverage && (
          <div style={{
            padding: '12px',
            backgroundColor: 'rgba(244, 67, 54, 0.05)',
            borderLeft: '4px solid #F44336',
            borderRadius: '4px'
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Lowest Coverage
            </div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
              {sorted[sorted.length - 1]?.label}
            </div>
            <div style={{ fontSize: '12px', color: '#F44336', fontWeight: '600' }}>
              {sorted[sorted.length - 1]?.coverage}%
            </div>
          </div>
        )}
      </div>

    </div>
  )
}

export default memo(MultiCategoryAnalysis)
