import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import logger from '../utils/logger'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet-draw'

export default function RasterMap({
  sites,
  rasterBounds,
  onPolygonChange
}) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const drawnItemsRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)

  // Initialize map
  useEffect(() => {
    // Clean up old map if it exists
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove()
      } catch (e) {
        logger.error("RasterMap", 'Error removing old map:', e)
      }
      mapInstanceRef.current = null
    }

    if (!mapRef.current) return

    try {
      // Create new map instance
      const mapContainer = mapRef.current
      const map = L.map(mapContainer, {
        preferCanvas: false,
        attributionControl: true,
        zoomControl: true
      })

      map.setView([68, 19], 6)

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map)

      // Add raster bounds if valid
      if (rasterBounds?.bounds) {
        const [[minLat, minLon], [maxLat, maxLon]] = rasterBounds.bounds

        if (isFinite(minLat) && isFinite(minLon) && isFinite(maxLat) && isFinite(maxLon)) {
          try {
            L.rectangle([[minLat, minLon], [maxLat, maxLon]], {
              color: '#ff7800',
              weight: 2,
              opacity: 0.5,
              fill: false
            }).addTo(map)

            map.fitBounds([[minLat, minLon], [maxLat, maxLon]])
          } catch (err) {
            logger.warn("RasterMap", 'Could not fit bounds:', err)
          }
        }
      }

      mapInstanceRef.current = map
      setMapReady(true)
      logger.debug("RasterMap", 'Map initialized successfully')
    } catch (error) {
      logger.error("RasterMap", 'Map init failed:', error)
      setMapReady(true)
    }

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove()
        } catch (e) {
          logger.error("RasterMap", 'Cleanup error:', e)
        }
        mapInstanceRef.current = null
      }
    }
  }, [rasterBounds])

  // Add site markers
  useEffect(() => {
    if (!mapInstanceRef.current || !sites || sites.length === 0) return

    const map = mapInstanceRef.current
    const siteMarkersGroup = L.featureGroup()

    // Filter sites with valid coordinates
    const validSites = sites.filter(site => {
      const lat = parseFloat(site.latitude)
      const lon = parseFloat(site.longitude)
      return isFinite(lat) && isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
    })

    validSites.forEach((site) => {
      const lat = parseFloat(site.latitude)
      const lon = parseFloat(site.longitude)

      const marker = L.circleMarker([lat, lon], {
        radius: 6,
        fillColor: '#2196F3',
        color: '#1565C0',
        weight: 2,
        opacity: 0.8,
        fillOpacity: 0.7
      })

      marker.bindPopup(
        `<div style="font-size: 12px;">
          <strong>Site ${site.siteNumber || '?'}</strong><br/>
          Lat: ${lat.toFixed(4)}<br/>
          Lon: ${lon.toFixed(4)}<br/>
          Accuracy: ${site.accuracy || '?'}m
        </div>`,
        { maxWidth: 200 }
      )

      marker.addTo(siteMarkersGroup)
    })

    if (validSites.length > 0) {
      siteMarkersGroup.addTo(map)
    }

    logger.debug("RasterMap", `Map: ${validSites.length}/${sites.length} sites with valid coordinates`)

    return () => {
      siteMarkersGroup.remove()
    }
  }, [sites, mapReady])

  // Set up drawing tools
  useEffect(() => {
    if (!mapInstanceRef.current || drawnItemsRef.current) return

    const map = mapInstanceRef.current
    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)
    drawnItemsRef.current = drawnItems

    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polygon: true,
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false
      },
      edit: {
        featureGroup: drawnItems,
        edit: true,
        remove: true
      }
    })

    map.addControl(drawControl)

    const handleDraw = (e) => {
      const layer = e.layer
      if (e.type === 'draw:created' || e.type === 'draw:edited') {
        drawnItems.clearLayers()
        drawnItems.addLayer(layer)

        const geojson = layer.toGeoJSON()
        onPolygonChange(geojson)
      }
    }

    map.on('draw:created', handleDraw)
    map.on('draw:edited', handleDraw)
    map.on('draw:deleted', () => {
      onPolygonChange(null)
    })

    return () => {
      map.removeControl(drawControl)
      map.off('draw:created', handleDraw)
      map.off('draw:edited', handleDraw)
      map.off('draw:deleted')
    }
  }, [onPolygonChange, mapReady])

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: '400px',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          overflow: 'hidden'
        }}
      />
      {!mapReady && (
        <div style={{
          position: 'absolute',
          top: '0',
          left: '0',
          right: '0',
          bottom: '0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          color: 'var(--text-secondary)',
          fontSize: '14px',
          zIndex: 300
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '8px' }}>🗺️ Loading map...</div>
            <div style={{ fontSize: '12px', color: '#999' }}>This may take a moment</div>
          </div>
        </div>
      )}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        backgroundColor: 'white',
        padding: '8px 12px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        fontSize: '12px',
        zIndex: 400
      }}>
        <div><strong>Blue circles:</strong> Field sites</div>
        <div><strong>Orange outline:</strong> Raster bounds</div>
        <div><strong>Draw polygon:</strong> Use toolbar</div>
      </div>
    </div>
  )
}
