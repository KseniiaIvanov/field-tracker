import { useState, useEffect } from 'react'
import RasterViewer from './RasterViewer'

const CATEGORIES = {
  moisture: { label: 'Moisture', color: '#2196F3' },
  vegetation: { label: 'Vegetation', color: '#4CAF50' },
  disturbance: { label: 'Disturbance', color: '#FF9800' },
  other: { label: 'Other', color: '#9C27B0' }
}

export default function MultiLayerRasterViewer({
  rastersByCategory,
  rasterDataCache,
  rgbDataCache,
  categorySettings,
  polygon,
  onPolygonChange,
  allEntries
}) {
  const [layerVisibility, setLayerVisibility] = useState({
    moisture: true,
    vegetation: true,
    disturbance: true,
    other: false
  })
  const [layerOpacity, setLayerOpacity] = useState({
    moisture: 1,
    vegetation: 0.7,
    disturbance: 0.7,
    other: 0.7
  })
  const [rgbVisible, setRgbVisible] = useState(true)
  const [rgbOpacity, setRgbOpacity] = useState(1)
  const [rgbColormap, setRgbColormap] = useState('auto') // 'auto' = detect RGB, or apply colormap

  // Synchronized zoom/pan state for all layers
  const [sharedZoom, setSharedZoom] = useState(1)
  const [sharedPanOffset, setSharedPanOffset] = useState({ x: 0, y: 0 })

  // Target CRS for raster loading
  const [targetCRS, setTargetCRS] = useState(() => {
    // Load from localStorage if available
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

  // Build list of all visible layers (RGB first, then categories)
  const visibleLayers = []

  // Add RGB if visible
  if (rgbVisible && rgbDataCache) {
    visibleLayers.push({
      type: 'rgb',
      key: 'rgb',
      label: 'RGB',
      data: rgbDataCache,
      opacity: rgbOpacity,
      colormap: rgbColormap === 'auto' ? 'viridis' : rgbColormap
    })
  }

  // Add visible categories
  const categoryOrder = ['moisture', 'vegetation', 'disturbance', 'other']
  for (const category of categoryOrder) {
    if (layerVisibility[category] && rasterDataCache[category]) {
      visibleLayers.push({
        type: 'category',
        key: category,
        label: CATEGORIES[category].label,
        data: rasterDataCache[category],
        opacity: layerOpacity[category],
        colormap: 'viridis'
      })
    }
  }

  // Fallback: if nothing visible, show first available
  if (visibleLayers.length === 0) {
    if (rgbDataCache) {
      visibleLayers.push({
        type: 'rgb',
        key: 'rgb',
        label: 'RGB',
        data: rgbDataCache,
        opacity: rgbOpacity,
        colormap: rgbColormap === 'auto' ? 'viridis' : rgbColormap
      })
    } else if (Object.keys(rasterDataCache).length > 0) {
      const firstKey = Object.keys(rasterDataCache)[0]
      visibleLayers.push({
        type: 'category',
        key: firstKey,
        label: CATEGORIES[firstKey].label,
        data: rasterDataCache[firstKey],
        opacity: 1,
        colormap: 'viridis'
      })
    } else {
      return (
        <div style={{
          padding: '16px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '8px',
          color: 'var(--text-secondary)',
          textAlign: 'center'
        }}>
          Upload RGB or rasters to view map
        </div>
      )
    }
  }

  // Debug logging - AFTER visibleLayers is fully built
  console.log(`🔍 MultiLayerRasterViewer: sharedZoom=${sharedZoom}, visibleLayers=${visibleLayers.length}`)

  // Log CRS for each visible layer
  visibleLayers.forEach((layer, idx) => {
    const crs = layer.data?.crs || 'unknown'
    const bounds = layer.data?.bounds ? `[${layer.data.bounds.west}-${layer.data.bounds.east}, ${layer.data.bounds.south}-${layer.data.bounds.north}]` : 'no bounds'
    console.log(`  Layer ${idx} (${layer.label}): CRS=${crs}, bounds=${bounds}`)
  })

  // Log polygon CRS
  if (polygon?.geometry?.coordinates) {
    console.log(`  Polygon: ${polygon.geometry.coordinates[0].length} points, first point: [${polygon.geometry.coordinates[0][0]}]`)
  }

  return (
    <div style={{
      padding: '16px',
      backgroundColor: 'var(--bg-secondary)',
      borderRadius: '8px',
      marginBottom: '24px'
    }}>
      <h3 style={{ margin: '0 0 12px 0', color: 'var(--text-primary)', fontSize: '14px' }}>
        🗺️ Multi-Layer Map
      </h3>

      {/* CRS Selection */}
      <div style={{
        marginBottom: '12px',
        padding: '8px',
        backgroundColor: 'rgba(33, 150, 243, 0.05)',
        borderRadius: '6px',
        borderLeft: '3px solid #2196F3'
      }}>
        <label style={{
          fontSize: '11px',
          fontWeight: '600',
          color: 'var(--text-secondary)',
          marginBottom: '4px',
          display: 'block'
        }}>
          🌍 TARGET COORDINATE SYSTEM
        </label>
        <select
          value={targetCRS}
          onChange={(e) => setTargetCRS(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: '12px',
            cursor: 'pointer',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontWeight: '500'
          }}
        >
          <option value="EPSG:4326">WGS84 (Lat/Lon) - Global</option>
          <option value="EPSG:32634">UTM Zone 34N - Abisko Region</option>
        </select>
        <div style={{
          fontSize: '9px',
          color: 'var(--text-secondary)',
          marginTop: '4px',
          fontStyle: 'italic'
        }}>
          ℹ️ Selected CRS will be used for new raster uploads. Currently loaded rasters will keep their CRS.
        </div>
      </div>

      {/* Layer Controls - Horizontal and Compact */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '10px',
        marginBottom: '12px',
        padding: '8px',
        backgroundColor: 'rgba(0,0,0,0.02)',
        borderRadius: '6px'
      }}>
        {/* RGB Base Layer Control */}
        {rgbDataCache && (
          <div style={{ fontSize: '11px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginBottom: '4px',
              cursor: 'pointer',
              color: 'var(--text-primary)'
            }}>
              <input
                type="checkbox"
                checked={rgbVisible}
                onChange={(e) => setRgbVisible(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ color: '#555', fontWeight: '600' }}>■</span>
              RGB
            </label>
            {rgbVisible && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={rgbOpacity * 100}
                    onChange={(e) => setRgbOpacity(parseInt(e.target.value) / 100)}
                    style={{ flex: 1, height: '14px', cursor: 'pointer' }}
                  />
                  <span style={{ minWidth: '18px', fontSize: '9px' }}>
                    {Math.round(rgbOpacity * 100)}%
                  </span>
                </div>
                <select
                  value={rgbColormap}
                  onChange={(e) => setRgbColormap(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '2px',
                    fontSize: '10px',
                    cursor: 'pointer'
                  }}
                >
                  <option value="auto">Auto (RGB)</option>
                  <option value="viridis">Viridis</option>
                  <option value="rdylbu">RdYlBu</option>
                  <option value="grayscale">Grayscale</option>
                </select>
              </>
            )}
          </div>
        )}

        {Object.entries(CATEGORIES)
          .filter(([key]) => rastersByCategory[key])
          .map(([key, cat]) => (
            <div key={key} style={{ fontSize: '11px' }}>
              {/* Visibility */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginBottom: '4px',
                cursor: 'pointer',
                color: 'var(--text-primary)'
              }}>
                <input
                  type="checkbox"
                  checked={layerVisibility[key]}
                  onChange={(e) => setLayerVisibility(prev => ({
                    ...prev,
                    [key]: e.target.checked
                  }))}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ color: cat.color, fontWeight: '600' }}>■</span>
                {categorySettings[key]?.customName || cat.label}
              </label>

              {/* Opacity */}
              {layerVisibility[key] && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={layerOpacity[key] * 100}
                    onChange={(e) => setLayerOpacity(prev => ({
                      ...prev,
                      [key]: parseInt(e.target.value) / 100
                    }))}
                    style={{ flex: 1, height: '16px', cursor: 'pointer' }}
                  />
                  <span style={{ minWidth: '20px', fontSize: '10px' }}>
                    {Math.round(layerOpacity[key] * 100)}%
                  </span>
                </div>
              )}
            </div>
          ))}
      </div>

      {/* Multi-Layer Raster Viewer - Stack all visible layers */}
      {visibleLayers.length > 0 && (
        <div style={{ position: 'relative' }}>
          {visibleLayers.map((layer, idx) => (
            <div
              key={layer.key}
              style={{
                position: idx === 0 ? 'relative' : 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                zIndex: idx,
                opacity: layer.opacity
              }}
            >
              <RasterViewer
                rasterData={layer.data}
                polygon={polygon}
                onPolygonChange={idx === 0 ? onPolygonChange : undefined}
                sites={idx === 0 ? (allEntries || []) : []}
                colormap={layer.colormap}
                opacity={1}
                readOnly={idx > 0}
                // Synchronized zoom/pan for all layers
                zoom={sharedZoom}
                onZoomChange={setSharedZoom}
                panOffset={sharedPanOffset}
                onPanOffsetChange={setSharedPanOffset}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
