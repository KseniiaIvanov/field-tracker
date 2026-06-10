/**
 * Raster Metadata Display
 * Shows CRS and other metadata for uploaded rasters
 */

import { crsValidators } from '../utils/validators'

export default function RasterMetadataDisplay({ rastersByCategory, categorySettings }) {
  if (!rastersByCategory || Object.keys(rastersByCategory).length === 0) {
    return (
      <div style={{
        padding: '16px',
        backgroundColor: 'rgba(33, 150, 243, 0.1)',
        border: '1px solid #2196F3',
        borderRadius: '6px',
        color: 'var(--text-primary)',
        fontSize: '13px',
        marginBottom: '16px'
      }}>
        📋 <strong>No rasters uploaded yet.</strong> Upload GeoTIFF files to see metadata.
      </div>
    )
  }

  const CATEGORIES = {
    moisture: { label: 'Moisture', color: '#2196F3' },
    vegetation: { label: 'Vegetation', color: '#4CAF50' },
    disturbance: { label: 'Disturbance', color: '#FF9800' },
    other: { label: 'Other', color: '#9C27B0' }
  }

  return (
    <div style={{ marginBottom: '20px' }}>
      <h4 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>
        📊 Uploaded Rasters & CRS Information
      </h4>

      {Object.entries(rastersByCategory).map(([category, rasterInfo]) => {
        const categoryData = CATEGORIES[category] || { label: category, color: '#757575' }
        if (!categoryData) return null

        // Validate CRS
        const crsCheck = crsValidators.epsg(rasterInfo.crs)
        const isUTM = crsCheck.isValid && crsValidators.isUTM(rasterInfo.crs)
        const isGeographic = crsCheck.isValid && crsValidators.isGeographic(rasterInfo.crs)

        return (
          <div
            key={category}
            style={{
              padding: '12px',
              backgroundColor: 'var(--bg-secondary)',
              border: `2px solid ${categoryData.color}`,
              borderRadius: '6px',
              marginBottom: '10px',
              fontSize: '12px'
            }}
          >
            {/* Header with category and status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  backgroundColor: categoryData.color,
                  borderRadius: '3px'
                }}
              />
              <strong style={{ color: 'var(--text-primary)' }}>
                {categoryData.label}
              </strong>
              <span style={{
                padding: '2px 6px',
                backgroundColor: categorySettings && categorySettings[category]?.enabled ? '#4CAF50' : '#FF9800',
                color: 'white',
                borderRadius: '3px',
                fontSize: '11px',
                fontWeight: '600'
              }}>
                {categorySettings && categorySettings[category]?.enabled ? '✓ Enabled' : '○ Disabled'}
              </span>
            </div>

            {/* Raster info grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {/* File name */}
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>📄 File:</span>
                <div style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                  {rasterInfo.fileName}
                </div>
              </div>

              {/* CRS */}
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>🗺️ CRS (Current):</span>
                <div style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                  {rasterInfo.crs}
                  {!crsCheck.isValid && (
                    <span style={{ color: '#F44336' }}> ⚠️ Invalid</span>
                  )}
                </div>
              </div>

              {/* Original CRS - if different from current */}
              {rasterInfo.metadata?.originalCRS && rasterInfo.metadata.originalCRS !== rasterInfo.crs && (
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>📍 Original CRS:</span>
                  <div style={{ color: '#FF9800', fontSize: '11px' }}>
                    {rasterInfo.metadata.originalCRS} (auto-transformed)
                  </div>
                </div>
              )}

              {/* CRS Type */}
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>📍 Type:</span>
                <div style={{ color: 'var(--text-primary)' }}>
                  {isGeographic && '🌍 Geographic (Lat/Lon)'}
                  {isUTM && '📐 UTM (Projected)'}
                  {!isGeographic && !isUTM && crsCheck.isValid && '❓ Other'}
                  {!crsCheck.isValid && '❌ Unknown'}
                </div>
              </div>

              {/* Upload date */}
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>📅 Uploaded:</span>
                <div style={{ color: 'var(--text-primary)' }}>
                  {new Date(rasterInfo.uploadedAt).toLocaleDateString()}
                </div>
              </div>

              {/* Bounds */}
              {rasterInfo.bounds && (Object.keys(rasterInfo.bounds).length > 0) && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>📦 Bounds:</span>
                  <div style={{
                    color: 'var(--text-primary)',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    marginTop: '2px'
                  }}>
                    {/* Support both field name formats */}
                    {rasterInfo.bounds.west !== undefined ? (
                      <>
                        Lat (N-S): [{rasterInfo.bounds.south?.toFixed(5)}, {rasterInfo.bounds.north?.toFixed(5)}]<br/>
                        Lon (W-E): [{rasterInfo.bounds.west?.toFixed(5)}, {rasterInfo.bounds.east?.toFixed(5)}]
                      </>
                    ) : (
                      <>
                        Lat: [{rasterInfo.bounds.minLat?.toFixed(5)}, {rasterInfo.bounds.maxLat?.toFixed(5)}]<br/>
                        Lon: [{rasterInfo.bounds.minLon?.toFixed(5)}, {rasterInfo.bounds.maxLon?.toFixed(5)}]
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* CRS Requirements Info */}
      <div style={{
        padding: '12px',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        border: '1px solid #4CAF50',
        borderRadius: '6px',
        marginTop: '16px',
        fontSize: '12px',
        color: 'var(--text-primary)'
      }}>
        <strong style={{ color: '#4CAF50' }}>✓ CRS Requirements:</strong>
        <ul style={{ marginTop: '6px', marginBottom: '0', paddingLeft: '20px' }}>
          <li><strong>Geographic (Lat/Lon)</strong>: EPSG:4326, EPSG:4269, EPSG:4267
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Coordinates in degrees</div>
          </li>
          <li><strong>UTM Projected</strong>: EPSG:326xx or EPSG:327xx
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Coordinates in meters</div>
          </li>
          <li><strong>Polygon</strong>: Must be in WGS84 (EPSG:4326)
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Automatically detected & transformed</div>
          </li>
          <li><strong>Sites</strong>: Must have latitude/longitude in degrees
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Automatically converted to raster CRS</div>
          </li>
        </ul>
      </div>
    </div>
  )
}
