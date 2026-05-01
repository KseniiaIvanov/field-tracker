/**
 * Sensitivity analysis for algorithm thresholds
 * Shows how results change when you adjust critical/high/medium thresholds
 */

export function performSensitivityAnalysis(priorityScores, thresholdRange = [0.8, 1.0, 1.2]) {
  const results = {}

  // Current thresholds
  const baseCritical = 40
  const baseHigh = 30
  const baseMedium = 15

  // Test variations
  thresholdRange.forEach(multiplier => {
    const critical = Math.round(baseCritical * multiplier)
    const high = Math.round(baseHigh * multiplier)
    const medium = Math.round(baseMedium * multiplier)

    const counts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    }

    priorityScores.forEach(score => {
      if (score.missingPercent >= critical || score.peakMissingPercent > (critical + 10)) {
        counts.critical++
      } else if (score.missingPercent >= high || score.peakMissingPercent > (high + 10)) {
        counts.high++
      } else if (score.missingPercent >= medium || score.peakMissingPercent > (medium + 10)) {
        counts.medium++
      } else if (score.missingPercent > 0) {
        counts.low++
      }
    })

    results[`×${multiplier.toFixed(1)}`] = {
      thresholds: { critical, high, medium },
      counts,
      total: counts.critical + counts.high + counts.medium + counts.low,
      criticalPercent: ((counts.critical / (counts.critical + counts.high + counts.medium + counts.low)) * 100).toFixed(1)
    }
  })

  return results
}

/**
 * Generate report comparing different threshold sets
 */
export function generateSensitivityReport(analysisResults) {
  let report = '📊 SENSITIVITY ANALYSIS REPORT\n'
  report += '=' * 50 + '\n\n'

  report += 'How do results change when thresholds vary?\n\n'

  Object.entries(analysisResults).forEach(([label, data]) => {
    report += `${label} thresholds (critical=${data.thresholds.critical}%, high=${data.thresholds.high}%, medium=${data.thresholds.medium}%)\n`
    report += `  🔴 Critical zones: ${data.counts.critical}\n`
    report += `  🟠 High zones: ${data.counts.high}\n`
    report += `  🟡 Medium zones: ${data.counts.medium}\n`
    report += `  🟢 Low zones: ${data.counts.low}\n`
    report += `  Total: ${data.total} zones (${data.criticalPercent}% critical)\n\n`
  })

  report += 'Recommendation:\n'
  report += '- If results change dramatically → thresholds are sensitive, need better calibration\n'
  report += '- If results stable → thresholds are robust\n'

  return report
}
