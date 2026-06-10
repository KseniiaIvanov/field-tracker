import { useState, useEffect } from 'react'
import RasterViewer from './RasterViewer'

const CATEGORIES = {
  moisture: { label: 'Moisture', color: '#2196F3' },
  vegetation: { label: 'Vegetation', color: '#4CAF50' },
  disturbance: { label: 'Disturbance', color: '#FF9800' },
  other: { label: 'Other', color: '#9C27B0' }
}

// Default colormap per category (user can still change in the viewer)
const CATEGORY_COLORMAPS = {
  moisture: 'blues',
  vegetation: 'greens',
  disturbance: 'reds',
  other: 'plasma'
}

export default function RasterStack({
  rgbDataCache,
  rastersByCategory,
  rasterDataCache,
  categorySettings,
  polygon,
  onPolygonChange,
  allEntries,
  candidatePoints = []
}) {
  // Track which category rasters are visible (RGB always visible)
  const [visibleCategories, setVisibleCategories] = useState({
    vegetation: true,     // Visible by default - show polygon
    moisture: true,       // Visible by default
    disturbance: true,    // Visible by default
    other: true           // Visible by default
  })

  // Target CRS for raster loading
  const [targetCRS, setTargetCRS] = useState(() => {
    try {
      const saved = localStorage.getItem('rasterTargetCRS')
      return saved || 'EPSG:4326'
    } catch {
      return 'EPSG:4326'
    }
  })

  // Save targetCRS to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('rasterTargetCRS', targetCRS)
    } catch (e) {
      console.warn('Failed to save targetCRS to localStorage:', e)
    }
  }, [targetCRS])

  const toggleCategoryVisibility = (category) => {
    setVisibleCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }))
  }

  return (
    <div style={{ marginBottom: '24px' }}>
      {/* CRS Selection */}
      <div style={{
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: 'rgba(33, 150, 243, 0.05)',
        borderRadius: '6px',
        borderLeft: '3px solid #2196F3'
      }}>
        <label style={{
          fontSize: '11px',
          fontWeight: '600',
          color: 'var(--text-secondary)',
          marginBottom: '6px',
          display: 'block'
        }}>
          🌍 TARGET COORDINATE SYSTEM FOR NEW UPLOADS
        </label>
        <select
          value={targetCRS}
          onChange={(e) => setTargetCRS(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: '12px',
            cursor: 'pointer',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontWeight: '500'
          }}
        >
          <option value="EPSG:4326">WGS84 (Lat/Lon) - Global Standard</option>
          <option value="EPSG:32634">UTM Zone 34N - Abisko Region</option>
        </select>
        <div style={{
          fontSize: '9px',
          color: 'var(--text-secondary)',
          marginTop: '6px',
          fontStyle: 'italic'
        }}>
          ℹ️ Future rasters will be loaded in this CRS
        </div>
      </div>

      {/* RGB Layer - Always Visible */}
      {rgbDataCache && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            padding: '12px',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            borderRadius: '6px',
            marginBottom: '8px',
            borderLeft: '3px solid #2196F3'
          }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#2196F3', fontSize: '13px' }}>
              🖼️ RGB Base Layer
            </h4>
            <div style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              display: 'flex',
              gap: '16px',
              alignItems: 'center'
            }}>
              <span>📐 {rgbDataCache.width} × {rgbDataCache.height} px</span>
              <span>📍 CRS: {rgbDataCache.crs}</span>
            </div>
          </div>
          <RasterViewer
            rasterData={rgbDataCache}
            polygon={polygon}
            onPolygonChange={onPolygonChange}
            sites={allEntries || []}
            candidatePoints={candidatePoints}
            opacity={1}
            readOnly={false}
          />
        </div>
      )}

      {/* Category Rasters - Conditional Visibility */}
      {Object.entries(CATEGORIES)
        .filter(([key]) => rastersByCategory[key] && rasterDataCache[key])
        .map(([key, cat]) => {
          const isVisible = visibleCategories[key]
          const categoryName = key === 'other' ? categorySettings.other?.customName : cat.label
          const rasterData = rasterDataCache[key]

          // Debug: log whenever a category is about to render
          console.log(`  Rendering ${key}: visible=${isVisible}, has geotransform=${!!rasterData?.geotransform}, has pixels=${!!rasterData?.pixels}, width=${rasterData?.width}, height=${rasterData?.height}`)

          return (
            <div key={key} style={{ marginBottom: '24px' }}>
              {/* Category Header with Toggle */}
              <div
                onClick={() => toggleCategoryVisibility(key)}
                style={{
                  padding: '12px',
                  backgroundColor: `rgba(${hexToRgb(cat.color)}, 0.1)`,
                  borderRadius: '6px',
                  marginBottom: '8px',
                  borderLeft: `3px solid ${cat.color}`,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  userSelect: 'none'
                }}
              >
                <div>
                  <h4 style={{ margin: '0 0 8px 0', color: cat.color, fontSize: '13px' }}>
                    <span style={{ marginRight: '8px' }}>{isVisible ? '▼' : '▶'}</span>
                    {categoryName} Layer
                  </h4>
                  <div style={{
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    gap: '16px'
                  }}>
                    <span>📐 {rasterData.width} × {rasterData.height} px</span>
                    <span>📍 CRS: {rasterData.crs}</span>
                  </div>
                </div>
                <span style={{ fontSize: '20px', opacity: 0.5 }}>
                  {isVisible ? '📖' : '📕'}
                </span>
              </div>

              {/* Category Raster Viewer - Shown Only When Visible */}
              {isVisible && (
                <div>
                  <RasterViewer
                    rasterData={rasterDataCache[key]}
                    polygon={polygon}
                    onPolygonChange={onPolygonChange}
                    sites={allEntries || []}
                    candidatePoints={candidatePoints}
                    colormap={CATEGORY_COLORMAPS[key] || 'viridis'}
                    opacity={0.8}
                    readOnly={false}
                  />
                </div>
              )}
            </div>
          )
        })}

      {/* Info Box */}
      {!rgbDataCache && Object.keys(rastersByCategory).length === 0 && (
        <div style={{
          padding: '16px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '8px',
          color: 'var(--text-secondary)',
          textAlign: 'center',
          fontSize: '12px'
        }}>
          📋 Upload RGB and rasters to view map
        </div>
      )}
    </div>
  )
}

// Helper function to convert hex color to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '100, 100, 100'
}
