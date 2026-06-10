import { useMemo } from 'react'

/**
 * Display interpretation and insights about analysis results
 * Shows why points are critical, summary statistics, and recommendations
 */
export default function AnalysisInsights({
  candidatePoints = [],
  unsampledAnalysis = {},
  distributionAdvice = {},
  powerAnalysis = null
}) {
  // Calculate distribution by zone level
  const zoneCounts = useMemo(() => {
    return {
      critical: candidatePoints.filter(p => p.zoneLevel === 'critical').length,
      high: candidatePoints.filter(p => p.zoneLevel === 'high').length,
      medium: candidatePoints.filter(p => p.zoneLevel === 'medium').length,
      low: candidatePoints.filter(p => p.zoneLevel === 'low').length
    }
  }, [candidatePoints])

  const totalPoints = candidatePoints.length

  // Find which parameters are most problematic
  const parameterCriticality = useMemo(() => {
    return Object.entries(unsampledAnalysis).map(([category, data]) => ({
      category,
      missing: data.missingPercent || 0,
      peakMissing: data.peakMissingPercent || 0,
      hasUnsampled: data.hasUnsampled
    })).sort((a, b) => b.missing - a.missing)
  }, [unsampledAnalysis])

  const mostProblematic = parameterCriticality[0]

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16px',
      marginTop: '16px'
    }}>
      {/* Summary Card */}
      <div style={{
        padding: '16px',
        backgroundColor: 'rgba(33, 150, 243, 0.1)',
        border: '2px solid #2196F3',
        borderRadius: '8px'
      }}>
        <h4 style={{ marginTop: 0, marginBottom: '12px', color: '#2196F3', fontSize: '13px' }}>
          📊 Analysis Summary
        </h4>

        <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: '1.6' }}>
          <div style={{ marginBottom: '8px' }}>
            <strong>Total candidate points:</strong> {totalPoints}
          </div>

          <div style={{ marginBottom: '8px' }}>
            <strong>Distribution:</strong>
            <div style={{ marginLeft: '12px', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              <div>🔴 Critical: {zoneCounts.critical} ({((zoneCounts.critical / totalPoints) * 100).toFixed(0)}%)</div>
              <div>🟠 High: {zoneCounts.high} ({((zoneCounts.high / totalPoints) * 100).toFixed(0)}%)</div>
              <div>🟡 Medium: {zoneCounts.medium} ({((zoneCounts.medium / totalPoints) * 100).toFixed(0)}%)</div>
              <div>🟢 Low: {zoneCounts.low} ({((zoneCounts.low / totalPoints) * 100).toFixed(0)}%)</div>
            </div>
          </div>

          {powerAnalysis && (
            <div style={{ marginBottom: '8px', padding: '8px', backgroundColor: 'rgba(76, 175, 80, 0.1)', borderRadius: '4px' }}>
              <strong style={{ color: '#4CAF50' }}>📈 Sample Size:</strong>
              <div style={{ fontSize: '11px', marginTop: '4px' }}>
                Recommend: <strong>{powerAnalysis.suggested}</strong> new points<br/>
                Power: {powerAnalysis.achievedPower}%
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Most Problematic Parameter */}
      {mostProblematic && (
        <div style={{
          padding: '16px',
          backgroundColor: mostProblematic.missing > 50 ? 'rgba(244, 67, 54, 0.1)' : 'rgba(255, 152, 0, 0.1)',
          border: `2px solid ${mostProblematic.missing > 50 ? '#F44336' : '#FF9800'}`,
          borderRadius: '8px'
        }}>
          <h4 style={{
            marginTop: 0,
            marginBottom: '12px',
            color: mostProblematic.missing > 50 ? '#F44336' : '#FF9800',
            fontSize: '13px'
          }}>
            ⚠️ Most Undersampled
          </h4>

          <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: '1.6' }}>
            <div style={{ marginBottom: '8px' }}>
              <strong style={{ textTransform: 'capitalize', fontSize: '13px' }}>
                {mostProblematic.category}
              </strong>
              <div style={{ fontSize: '24px', color: mostProblematic.missing > 50 ? '#F44336' : '#FF9800', fontWeight: 'bold' }}>
                {mostProblematic.missing.toFixed(1)}%
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                missing across polygon
              </div>
            </div>

            {mostProblematic.missing > 50 && (
              <div style={{
                padding: '8px',
                backgroundColor: 'rgba(244, 67, 54, 0.2)',
                borderRadius: '4px',
                fontSize: '11px',
                borderLeft: '3px solid #F44336',
                paddingLeft: '10px'
              }}>
                <strong>Action:</strong> Prioritize field measurements for this parameter
              </div>
            )}
          </div>
        </div>
      )}

      {/* Parameter Breakdown */}
      <div style={{
        gridColumn: '1 / -1',
        padding: '16px',
        backgroundColor: 'var(--bg-primary)',
        borderRadius: '8px',
        border: '1px solid #E0E0E0'
      }}>
        <h4 style={{ marginTop: 0, marginBottom: '12px', color: 'var(--text-primary)', fontSize: '13px' }}>
          📈 Parameter Analysis
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          {parameterCriticality.map((param) => {
            const status =
              param.missing > 50 ? 'CRITICAL' :
              param.missing > 30 ? 'HIGH' :
              param.missing > 15 ? 'MODERATE' :
              'LOW'

            const statusColor =
              param.missing > 50 ? '#F44336' :
              param.missing > 30 ? '#FF9800' :
              param.missing > 15 ? '#FFC107' :
              '#4CAF50'

            const advice = distributionAdvice[param.category]

            return (
              <div
                key={param.category}
                style={{
                  padding: '12px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderLeft: `4px solid ${statusColor}`,
                  borderRadius: '4px',
                  fontSize: '11px'
                }}
              >
                <div style={{ textTransform: 'capitalize', fontWeight: '600', marginBottom: '4px' }}>
                  {param.category}
                </div>

                <div style={{ marginBottom: '4px' }}>
                  <strong style={{ color: statusColor, fontSize: '12px' }}>
                    {param.missing.toFixed(1)}% missing
                  </strong>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                    Status: {status}
                  </div>
                </div>

                {advice && (
                  <div style={{
                    marginTop: '6px',
                    padding: '4px',
                    backgroundColor: 'rgba(0,0,0,0.05)',
                    borderRadius: '3px',
                    fontSize: '10px',
                    fontStyle: 'italic',
                    color: 'var(--text-secondary)'
                  }}>
                    📊 {advice.shape.toUpperCase()}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Recommendations */}
      <div style={{
        gridColumn: '1 / -1',
        padding: '16px',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderLeft: '4px solid #4CAF50',
        borderRadius: '4px'
      }}>
        <h4 style={{ marginTop: 0, marginBottom: '8px', color: '#4CAF50', fontSize: '13px' }}>
          ✅ Recommendations for Field Campaign
        </h4>

        <div style={{ fontSize: '11px', color: 'var(--text-primary)', lineHeight: '1.8' }}>
          <div style={{ marginBottom: '6px' }}>
            <strong>1. Sampling Strategy:</strong>
            <div style={{ marginLeft: '12px', color: 'var(--text-secondary)' }}>
              Start with <strong>{zoneCounts.critical}</strong> critical points (red markers)
              {zoneCounts.critical > 20 && ' - consider focusing on top 20 by priority'}
            </div>
          </div>

          <div style={{ marginBottom: '6px' }}>
            <strong>2. Parameter Focus:</strong>
            <div style={{ marginLeft: '12px', color: 'var(--text-secondary)' }}>
              Prioritize measurements for <strong>{mostProblematic?.category}</strong>
              {' '} ({mostProblematic?.missing.toFixed(1)}% missing)
            </div>
          </div>

          {powerAnalysis && (
            <div>
              <strong>3. Sample Size:</strong>
              <div style={{ marginLeft: '12px', color: 'var(--text-secondary)' }}>
                Collect <strong>{powerAnalysis.suggested}</strong> new measurements
                {' '} to achieve {powerAnalysis.achievedPower}% statistical power
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
