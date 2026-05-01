/**
 * Power Analysis for determining optimal sample size
 * Based on Cohen's method for detecting effect sizes
 */

import logger from './logger'

/**
 * Calculate required sample size for statistical power
 * @param {number} baselineN - existing sample size (e.g., 604)
 * @param {number} effectSize - Cohen's d: 0.2 (small), 0.5 (medium), 0.8 (large)
 * @param {number} power - desired power: 0.8 (80%), 0.9 (90%)
 * @param {number} alpha - significance level: 0.05 (default)
 * @returns {object} { requiredN, additionalPoints, recommendation }
 */
export function calculateRequiredSampleSize(
  baselineN = 604,
  effectSize = 0.5,
  power = 0.8,
  alpha = 0.05
) {
  // Get critical values for power and alpha
  const zAlpha = getZScore(1 - alpha / 2)  // two-tailed
  const zBeta = getZScore(power)

  // Cohen's formula for two-sample comparison
  // n = 2 * ((z_alpha + z_beta) / effect_size)^2
  const nPerGroup = Math.pow((zAlpha + zBeta) / effectSize, 2)
  const totalRequired = Math.ceil(nPerGroup * 2)

  // Account for correlation with existing data (we already have baseline)
  // Reduction factor: we can get ~30% improvement from smaller sample
  const correlationReduction = 0.7
  const adjustedRequired = Math.ceil(totalRequired * correlationReduction)

  const additionalPoints = Math.max(10, Math.min(adjustedRequired - baselineN, 100))

  let recommendation = ''
  if (effectSize < 0.3) {
    recommendation = 'Very small effect - requires many samples'
  } else if (effectSize < 0.5) {
    recommendation = 'Small effect - standard recommendation'
  } else if (effectSize < 0.8) {
    recommendation = 'Medium effect - typical for field studies'
  } else {
    recommendation = 'Large effect - relatively few samples needed'
  }

  logger.debug('powerAnalysis', `Baseline: ${baselineN}, Effect: ${effectSize}, Power: ${power}`)
  logger.debug('powerAnalysis', `Required total: ${totalRequired}, Additional: ${additionalPoints}`)

  return {
    requiredN: adjustedRequired,
    additionalPoints,
    totalSamples: baselineN + additionalPoints,
    recommendation,
    parameters: { effectSize, power, alpha }
  }
}

/**
 * Get Z-score from cumulative probability
 * Approximation using error function
 */
function getZScore(p) {
  if (p < 0.001) return -3.09
  if (p < 0.01) return -2.33
  if (p < 0.025) return -1.96
  if (p < 0.05) return -1.645
  if (p < 0.1) return -1.282
  if (p < 0.5) return 0
  if (p < 0.9) return 1.282
  if (p < 0.95) return 1.645
  if (p < 0.975) return 1.96
  if (p < 0.99) return 2.33
  return 3.09
}

/**
 * Generate power analysis report
 * Shows how sample size changes for different effect sizes
 */
export function generatePowerReport(baselineN = 604) {
  const effectSizes = [0.2, 0.5, 0.8]
  const powers = [0.8, 0.9]

  const results = {}

  effectSizes.forEach(effectSize => {
    results[effectSize] = {}
    powers.forEach(power => {
      const analysis = calculateRequiredSampleSize(baselineN, effectSize, power)
      results[effectSize][power] = analysis.additionalPoints
    })
  })

  let report = '📊 POWER ANALYSIS REPORT\n'
  report += '='.repeat(60) + '\n'
  report += `Baseline sample size: ${baselineN}\n\n`

  report += 'Additional points needed by effect size and power:\n'
  report += '(To detect this effect size with this statistical power)\n\n'

  report += '            80% Power    90% Power\n'
  report += '─'.repeat(40) + '\n'
  report += `Small (d=0.2): ${String(results[0.2][0.8]).padEnd(5)} ${String(results[0.2][0.9]).padEnd(5)}\n`
  report += `Medium (d=0.5): ${String(results[0.5][0.8]).padEnd(5)} ${String(results[0.5][0.9]).padEnd(5)}\n`
  report += `Large (d=0.8): ${String(results[0.8][0.8]).padEnd(5)} ${String(results[0.8][0.9]).padEnd(5)}\n`

  report += '\n💡 Recommendations:\n'
  report += '• For ecological studies, medium effect (d=0.5) is typical\n'
  report += `• With ${baselineN} baseline samples, recommend ${results[0.5][0.8]} additional points\n`
  report += '• If power < 0.8, results may be inconclusive\n'

  return { report, results }
}

/**
 * Calculate power given sample size
 * (inverse: what power can we achieve with N samples?)
 */
export function calculateAchievablePower(
  sampleSize,
  effectSize = 0.5,
  alpha = 0.05
) {
  const zAlpha = getZScore(1 - alpha / 2)
  const nPerGroup = sampleSize / 2
  const lambda = Math.sqrt(nPerGroup) * effectSize
  const zBeta = Math.abs(lambda) - zAlpha

  // Approximate power from z-score
  const power = zBeta > 3.09 ? 0.999 : getPhiFromZ(zBeta)

  return {
    achievedPower: power,
    percentage: (power * 100).toFixed(1),
    sampleSize
  }
}

/**
 * Approximate CDF of standard normal
 */
function getPhiFromZ(z) {
  if (z < -3.09) return 0.001
  if (z < -2.33) return 0.01
  if (z < -1.96) return 0.025
  if (z < -1.645) return 0.05
  if (z < -1.282) return 0.1
  if (z < 0) return 0.5
  if (z < 1.282) return 0.9
  if (z < 1.645) return 0.95
  if (z < 1.96) return 0.975
  if (z < 2.33) return 0.99
  return 0.999
}

/**
 * Suggest optimal number of new points based on:
 * 1. Desired effect size
 * 2. Desired power
 * 3. Current sample size
 * 4. Budget constraints
 */
export function suggestOptimalSampleSize(options = {}) {
  const {
    baselineN = 604,
    desiredEffectSize = 0.5,
    desiredPower = 0.8,
    maxBudget = 50,  // max additional points can collect
    minRecommendation = 10
  } = options

  const analysis = calculateRequiredSampleSize(
    baselineN,
    desiredEffectSize,
    desiredPower
  )

  let suggested = Math.min(analysis.additionalPoints, maxBudget)
  suggested = Math.max(suggested, minRecommendation)

  const achievedPower = calculateAchievablePower(
    baselineN + suggested,
    desiredEffectSize
  )

  return {
    suggested,
    ideal: analysis.additionalPoints,
    limited: suggested < analysis.additionalPoints,
    achievedPower: parseFloat(achievedPower.percentage),
    targetPower: desiredPower * 100,
    message: suggested < analysis.additionalPoints
      ? `⚠️ Limited to ${suggested} points. Power will be ${achievedPower.percentage}% (target: ${desiredPower*100}%)`
      : `✅ ${suggested} points will achieve ${achievedPower.percentage}% power`
  }
}
