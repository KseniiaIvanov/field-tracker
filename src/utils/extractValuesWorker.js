// Web Worker для анализа полигонов (не блокирует UI)
// Вычисляет значения пиксей внутри полигона

function pointInPolygon(point, polygon) {
  const [lon, lat] = point
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]

    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }

  return inside
}

// NoData / NA detection — must match isNoDataValue() in rasterProcessing.js
function isNoDataValue(value) {
  if (value === null || value === undefined || !isFinite(value)) return true
  if (value <= -9000) return true   // -9999, -9998, -32768, etc.
  if (value >= 1e20) return true    // large positive fill
  return false
}

// Получить значение пиксела
function getPixelValue(pixels, width, x, y) {
  if (x < 0 || x >= width || y < 0) return null
  const index = y * width + x
  if (index >= pixels.length) return null
  const value = pixels[index]
  if (isNoDataValue(value)) return null
  return value
}

// Преобразовать пиксель в координаты (упрощено, без CRS конверсии)
function pixelToCoordinateLonLat(x, y, geotransform) {
  const originX = geotransform[0]
  const pixelWidth = geotransform[1]
  const originY = geotransform[3]
  const pixelHeight = geotransform[5] // отрицательное

  const lon = originX + x * pixelWidth + y * geotransform[2]
  const lat = originY + x * geotransform[4] + y * pixelHeight

  return { lon, lat }
}

self.onmessage = function(event) {
  const { pixels, width, geotransform, polygonCoords, minPixelX, maxPixelX, minPixelY, maxPixelY } = event.data

  const values = []
  let pixelsChecked = 0
  let pixelsInPolygon = 0

  // Итерировать по пикселям внутри полигона
  for (let y = minPixelY; y <= maxPixelY; y++) {
    for (let x = minPixelX; x <= maxPixelX; x++) {
      pixelsChecked++

      try {
        const coord = pixelToCoordinateLonLat(x, y, geotransform)

        if (pointInPolygon([coord.lon, coord.lat], polygonCoords)) {
          pixelsInPolygon++
          const value = getPixelValue(pixels, width, x, y)
          if (value !== null && isFinite(value)) {
            values.push(value)
          }
        }
      } catch {
        // Ignore pixel errors
      }
    }

    // Отправить прогресс каждые 100 линий
    if (y % 100 === 0) {
      self.postMessage({
        type: 'progress',
        processed: (y - minPixelY + 1) * (maxPixelX - minPixelX + 1),
        total: (maxPixelY - minPixelY + 1) * (maxPixelX - minPixelX + 1)
      })
    }
  }

  // Отправить результаты
  self.postMessage({
    type: 'complete',
    values,
    pixelsChecked,
    pixelsInPolygon
  })
}
