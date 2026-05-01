/**
 * Utilities for rendering priority heat maps
 * Converts priority grid values to RGBA colors for visualization
 */

/**
 * Get color for priority value using gradient
 * Low (green) → Medium (yellow) → High (orange) → Critical (red)
 *
 * @param {number} value - Priority value (typically 0-16+)
 * @param {number} maxValue - Maximum priority in dataset (for normalization)
 * @returns {[r, g, b, a]} RGBA color array (0-255)
 */
export function getPriorityColor(value, maxValue = 16) {
  if (!isFinite(value) || value === 0) {
    return [0, 0, 0, 0] // Transparent for no data
  }

  // Normalize to 0-1 range
  const normalized = Math.min(1, Math.max(0, value / maxValue))

  // Color gradient: green → yellow → orange → red
  let r, g, b

  if (normalized < 0.25) {
    // Green to Yellow (0% to 25%)
    const t = normalized / 0.25
    r = Math.round(100 + t * 100) // 100 to 200
    g = 180
    b = 0
  } else if (normalized < 0.5) {
    // Yellow to Orange (25% to 50%)
    const t = (normalized - 0.25) / 0.25
    r = 200 + t * 55  // 200 to 255
    g = Math.round(180 - t * 80) // 180 to 100
    b = 0
  } else if (normalized < 0.75) {
    // Orange to Deep Orange (50% to 75%)
    const t = (normalized - 0.5) / 0.25
    r = 255
    g = Math.round(100 - t * 50) // 100 to 50
    b = 0
  } else {
    // Deep Orange to Red (75% to 100%)
    const t = (normalized - 0.75) / 0.25
    r = 255
    g = Math.round(50 - t * 30) // 50 to 20
    b = Math.round(t * 10) // 0 to 10
  }

  return [r, g, b, 200] // Full opacity (200/255 ≈ 78%)
}

/**
 * Create a priority heat map canvas from priority grid
 *
 * @param {object} priorityGrid - { width, height, cells: [priorityValues] }
 * @param {number} canvasWidth - Output canvas width
 * @param {number} canvasHeight - Output canvas height
 * @param {number} opacity - Opacity 0-1 (default 0.6)
 * @returns {CanvasImageData} Can be drawn with ctx.putImageData()
 */
export function createPriorityHeatMap(priorityGrid, canvasWidth, canvasHeight, opacity = 0.6) {
  if (!priorityGrid || !priorityGrid.cells) {
    return null
  }

  const { width, height, cells } = priorityGrid

  // Create canvas data
  const imageData = new ImageData(canvasWidth, canvasHeight)
  const data = imageData.data

  // Calculate scaling factors
  const cellWidth = canvasWidth / width
  const cellHeight = canvasHeight / height

  // Find max value for color normalization
  const maxValue = Math.max(...cells.filter(v => isFinite(v) && v > 0), 1)

  // Fill each cell
  for (let gridY = 0; gridY < height; gridY++) {
    for (let gridX = 0; gridX < width; gridX++) {
      const gridIdx = gridY * width + gridX
      const priority = cells[gridIdx] || 0

      const [r, g, b, a] = getPriorityColor(priority, maxValue)
      const alphaScaled = Math.round(a * opacity)

      // Fill cell region in canvas
      const canvasX = Math.round(gridX * cellWidth)
      const canvasY = Math.round(gridY * cellHeight)
      const cellWidthPx = Math.round((gridX + 1) * cellWidth) - canvasX
      const cellHeightPx = Math.round((gridY + 1) * cellHeight) - canvasY

      for (let py = 0; py < cellHeightPx; py++) {
        for (let px = 0; px < cellWidthPx; px++) {
          const pixelIdx = ((canvasY + py) * canvasWidth + (canvasX + px)) * 4
          data[pixelIdx] = r     // R
          data[pixelIdx + 1] = g // G
          data[pixelIdx + 2] = b // B
          data[pixelIdx + 3] = alphaScaled // A
        }
      }
    }
  }

  return imageData
}

/**
 * Create a legend for priority heat map
 * Returns SVG string showing color scale
 *
 * @param {number} maxValue - Maximum priority value in dataset
 * @returns {string} SVG markup for legend
 */
export function createPriorityLegend(maxValue = 16) {
  const steps = [0, maxValue * 0.25, maxValue * 0.5, maxValue * 0.75, maxValue]
  const labels = ['Low\n(0)', 'Medium\n(25%)', 'High\n(50%)', 'Very High\n(75%)', 'Critical\n(100%)']

  let svg = `<svg width="200" height="80" style="background: var(--bg-secondary); border-radius: 4px; padding: 8px;">
    <text x="100" y="16" text-anchor="middle" style="font-size: 12px; font-weight: 600; fill: var(--text-primary);">Priority Scale</text>
  `

  // Draw gradient bars
  const barWidth = 30
  const startX = 20
  const startY = 28

  for (let i = 0; i < steps.length; i++) {
    const [r, g, b] = getPriorityColor(steps[i], maxValue)
    const x = startX + (i * barWidth)
    svg += `<rect x="${x}" y="${startY}" width="${barWidth - 2}" height="20" fill="rgb(${r},${g},${b})" stroke="#999" stroke-width="0.5"/>`
    svg += `<text x="${x + barWidth/2 - 2}" y="${startY + 36}" text-anchor="middle" style="font-size: 9px; fill: var(--text-secondary);">${labels[i]}</text>`
  }

  svg += '</svg>'
  return svg
}

/**
 * Zone-based coloring (discrete levels instead of gradient)
 * Used for cleaner zone visualization
 *
 * @param {string} zoneLevel - 'critical', 'high', 'medium', 'low'
 * @returns {[r, g, b, a]} RGBA color array
 */
export function getZoneLevelColor(zoneLevel) {
  const colors = {
    critical: [244, 67, 54, 220],   // Red
    high: [255, 152, 0, 200],       // Orange
    medium: [255, 193, 7, 180],     // Yellow
    low: [76, 175, 80, 150]         // Green
  }

  return colors[zoneLevel] || [128, 128, 128, 100] // Gray default
}

/**
 * Create zone-level heat map (discrete colors)
 * More intuitive than gradient heat map
 *
 * @param {array} zoneLevelGrid - 2D array of zone levels ('critical', 'high', etc.)
 * @param {number} canvasWidth - Output canvas width
 * @param {number} canvasHeight - Output canvas height
 * @param {number} opacity - Opacity 0-1 (default 0.5)
 * @returns {CanvasImageData}
 */
export function createZoneLevelHeatMap(zoneLevelGrid, canvasWidth, canvasHeight, opacity = 0.5) {
  if (!zoneLevelGrid || zoneLevelGrid.length === 0) {
    return null
  }

  const imageData = new ImageData(canvasWidth, canvasHeight)
  const data = imageData.data

  const height = zoneLevelGrid.length
  const width = zoneLevelGrid[0].length

  const cellWidth = canvasWidth / width
  const cellHeight = canvasHeight / height

  for (let gridY = 0; gridY < height; gridY++) {
    for (let gridX = 0; gridX < width; gridX++) {
      const zoneLevel = zoneLevelGrid[gridY][gridX]
      let [r, g, b, a] = getZoneLevelColor(zoneLevel)
      a = Math.round(a * opacity)

      const canvasX = Math.round(gridX * cellWidth)
      const canvasY = Math.round(gridY * cellHeight)
      const cellWidthPx = Math.round((gridX + 1) * cellWidth) - canvasX
      const cellHeightPx = Math.round((gridY + 1) * cellHeight) - canvasY

      for (let py = 0; py < cellHeightPx; py++) {
        for (let px = 0; px < cellWidthPx; px++) {
          const pixelIdx = ((canvasY + py) * canvasWidth + (canvasX + px)) * 4
          data[pixelIdx] = r
          data[pixelIdx + 1] = g
          data[pixelIdx + 2] = b
          data[pixelIdx + 3] = a
        }
      }
    }
  }

  return imageData
}
