/**
 * Configuration for priority grid algorithm
 * Allows different parameters to have different thresholds based on distribution shape
 */

// Default thresholds - can be overridden per parameter
export const DEFAULT_THRESHOLDS = {
  critical: { missing: 40, peak: 50 },
  high: { missing: 30, peak: 40 },
  medium: { missing: 15, peak: 25 },
  low: { missing: 5, peak: 10 }
}

// Parameter-specific configuration
// Determined by analyzing distribution shape of each parameter
export const PARAMETER_CONFIG = {
  moisture: {
    // Often bimodal (wet/dry microhabitats in tundra)
    thresholds: { critical: 35, peak: 45 },
    reason: 'Bimodal distribution - peak identification critical'
  },
  vegetation: {
    // Usually normal around peak green season
    // Increased from 40% to 50% to be less strict (vegetation often undersampled)
    thresholds: { critical: 50, peak: 60 },
    reason: 'Normal distribution - moderate thresholds to avoid over-flagging'
  },
  disturbance: {
    // Often sparse, non-normal
    thresholds: { critical: 50, peak: 60 },
    reason: 'Rare events - higher threshold tolerable'
  },
  other: {
    // Depends on what it is - use default
    thresholds: { critical: 40, peak: 50 },
    reason: 'Using default thresholds - analyze distribution first'
  }
}

// Jitter configuration per zone
export const JITTER_CONFIG = {
  critical: 0.25,  // Tighter clustering in critical zones
  high: 0.35,
  medium: 0.5,
  low: 0.5
}

// Points per zone
export const POINTS_PER_ZONE = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
}

// Sample size configuration
export const SAMPLE_CONFIG = {
  // Default: suggest 20 points
  // But this should be based on power analysis
  defaultTopN: 20,

  // For power analysis: effect size you want to detect (as fraction of std dev)
  // 0.2 = small effect, 0.5 = medium, 0.8 = large
  desiredEffectSize: 0.5,

  // Statistical power you want (0.8 = 80% chance to detect effect)
  desiredPower: 0.8
}

/**
 * Get thresholds for a specific parameter
 * @param {string} parameterName - 'moisture', 'vegetation', 'disturbance', 'other'
 * @returns {object} { critical, high, medium, low } thresholds
 */
export function getThresholdsForParameter(parameterName) {
  const config = PARAMETER_CONFIG[parameterName] || PARAMETER_CONFIG.other
  return {
    critical: config.thresholds.critical,
    high: config.thresholds.high,
    medium: config.thresholds.medium,
    low: 0,
    reason: config.reason
  }
}

/**
 * Analyze distribution shape and recommend thresholds
 * Should be called once per dataset to calibrate thresholds
 */
export function analyzeDistributionShape(histogram) {
  // Calculate skewness and kurtosis
  const mean = calculateMean(histogram.bins)
  const std = calculateStdDev(histogram.bins, mean)
  const skewness = calculateSkewness(histogram.bins, mean, std)
  const kurtosis = calculateKurtosis(histogram.bins, mean, std)

  // Classify distribution
  let shape = 'unknown'
  let recommendation = null

  if (Math.abs(skewness) < 0.5 && Math.abs(kurtosis - 3) < 2) {
    shape = 'normal'
    recommendation = 'Use standard thresholds: critical=40%, peak=50%'
  } else if (Math.abs(skewness) > 1) {
    shape = 'skewed'
    recommendation = 'Data is skewed - consider adjusting peak threshold to 45%'
  } else if (kurtosis > 5) {
    shape = 'peaked'
    recommendation = 'Highly peaked - increase peak_missing threshold to 60%'
  } else if (kurtosis < 2) {
    shape = 'flat_uniform'
    recommendation = 'Uniform distribution - can tolerate 50% missing in tails'
  }

  // Detect bimodality (for moisture in tundra!)
  const modes = findModes(histogram.bins)
  if (modes.length > 1 && Math.abs(modes[0] - modes[1]) > std) {
    shape = 'bimodal'
    recommendation = 'BIMODAL DISTRIBUTION! Need special handling - each mode separately'
  }

  return {
    shape,
    skewness: skewness.toFixed(2),
    kurtosis: kurtosis.toFixed(2),
    recommendation,
    suggestedThresholds: recommendThresholds(shape)
  }
}

function recommendThresholds(shape) {
  const baseThresholds = DEFAULT_THRESHOLDS

  switch(shape) {
    case 'normal':
      return { critical: 40, high: 30, medium: 15 }
    case 'skewed':
      return { critical: 45, high: 35, medium: 20 }
    case 'peaked':
      return { critical: 35, high: 25, medium: 12 }
    case 'flat_uniform':
      return { critical: 50, high: 40, medium: 25 }
    case 'bimodal':
      return { critical: 30, high: 20, medium: 10 } // Conservative!
    default:
      return baseThresholds
  }
}

// Utility functions for distribution analysis
function calculateMean(bins) {
  const total = bins.reduce((sum, b) => sum + b.count, 0)
  const weighted = bins.reduce((sum, b) => sum + (b.count * (b.min + b.max) / 2), 0)
  return total > 0 ? weighted / total : 0
}

function calculateStdDev(bins, mean) {
  const total = bins.reduce((sum, b) => sum + b.count, 0)
  const variance = bins.reduce((sum, b) => {
    const midpoint = (b.min + b.max) / 2
    return sum + b.count * Math.pow(midpoint - mean, 2)
  }, 0)
  return Math.sqrt(total > 0 ? variance / total : 0)
}

function calculateSkewness(bins, mean, std) {
  const total = bins.reduce((sum, b) => sum + b.count, 0)
  const thirdMoment = bins.reduce((sum, b) => {
    const midpoint = (b.min + b.max) / 2
    return sum + b.count * Math.pow((midpoint - mean) / std, 3)
  }, 0)
  return total > 0 ? (thirdMoment / total) : 0
}

function calculateKurtosis(bins, mean, std) {
  const total = bins.reduce((sum, b) => sum + b.count, 0)
  const fourthMoment = bins.reduce((sum, b) => {
    const midpoint = (b.min + b.max) / 2
    return sum + b.count * Math.pow((midpoint - mean) / std, 4)
  }, 0)
  return total > 0 ? (fourthMoment / total) : 0
}

function findModes(bins) {
  // Find local maxima in density
  const modes = []
  for (let i = 1; i < bins.length - 1; i++) {
    if (bins[i].density > bins[i-1].density && bins[i].density > bins[i+1].density) {
      modes.push(bins[i].min + (bins[i].max - bins[i].min) / 2)
    }
  }
  return modes
}
