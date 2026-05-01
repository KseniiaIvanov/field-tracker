import { useState, useRef, useEffect, memo } from 'react'
import logger from '../utils/logger'
import { createPriorityHeatMap, getZoneLevelColor } from '../utils/priorityHeatMap'

/**
 * Display priority heat map overlay on top of RasterViewer
 * Shows priority grid as color gradient
 */
function PriorityHeatMapViewerComponent({
  priorityGrid,
  width = 800,
  height = 600,
  opacity = 0.4,
  onOpacityChange = null
}) {
  const canvasRef = useRef(null)
  const [currentOpacity, setCurrentOpacity] = useState(opacity)

  useEffect(() => {
    if (!canvasRef.current || !priorityGrid) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    try {
      // Create heat map image data
      const imageData = createPriorityHeatMap(priorityGrid, canvas.width, canvas.height, currentOpacity)
      if (imageData) {
        ctx.putImageData(imageData, 0, 0)
      }
    } catch (err) {
      logger.error('PriorityHeatMapViewer', 'Error rendering heat map:', err.message)
    }
  }, [priorityGrid, width, height, currentOpacity])

  const handleOpacityChange = (newOpacity) => {
    setCurrentOpacity(newOpacity)
    if (onOpacityChange) {
      onOpacityChange(newOpacity)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Heat Map Canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          cursor: 'crosshair',
          border: 'none',
          zIndex: 5
        }}
      />

      {/* Opacity Control */}
      <div style={{
        position: 'absolute',
        top: '8px',
        right: '8px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        padding: '8px 12px',
        borderRadius: '6px',
        zIndex: 10,
        fontSize: '11px',
        color: 'white'
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ whiteSpace: 'nowrap' }}>Heat map:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={currentOpacity}
            onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
            style={{ width: '100px', cursor: 'pointer' }}
          />
          <span style={{ minWidth: '30px', textAlign: 'right' }}>
            {Math.round(currentOpacity * 100)}%
          </span>
        </label>
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute',
        bottom: '8px',
        left: '8px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        padding: '8px 12px',
        borderRadius: '6px',
        zIndex: 10,
        fontSize: '10px',
        color: 'white'
      }}>
        <div style={{ marginBottom: '6px', fontWeight: '600' }}>Priority Levels:</div>
        {[
          { level: 'low', label: '🟢 Low', color: [76, 175, 80] },
          { level: 'medium', label: '🟡 Medium', color: [255, 193, 7] },
          { level: 'high', label: '🟠 High', color: [255, 152, 0] },
          { level: 'critical', label: '🔴 Critical', color: [244, 67, 54] }
        ].map(item => (
          <div key={item.level} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              backgroundColor: `rgb(${item.color[0]}, ${item.color[1]}, ${item.color[2]})`,
              borderRadius: '2px'
            }} />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  )
}

export default memo(PriorityHeatMapViewerComponent)
