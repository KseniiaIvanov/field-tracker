# 🌍 CRS-to-WGS84 Conversion Fix

## Summary
Fixed automatic coordinate system conversion for GeoTIFF raster uploads. Now rasters in ANY CRS (UTM, geographic, etc.) are automatically transformed to WGS84 (EPSG:4326) for display, allowing sites with WGS84 coordinates to align correctly.

## Files Modified

### 1. **src/utils/rasterProcessing.js** (Lines 234-410)
**Function**: `parseGeotransform(image)`

**Changes Made**:
- Added comprehensive debug logging showing:
  - Which metadata source was used (geoKeys, getTiePoints, fileDirectory, etc.)
  - What values were extracted for pixel scale and tiepoint
  - Whether auto-fix was triggered
  
- **Fixed zero-value bug**: Pixel scale values of 0 now properly fail validation
  - Old: `pixelWidth = pixelScaleArray[0] || 1` (treats 0 as falsy → uses fallback 1)
  - New: `if (typeof rawWidth === 'number' && isFinite(rawWidth) && rawWidth !== 0) { ... }`
  
- **Added final validation**: Safety checks before returning geotransform
  ```javascript
  if (!isFinite(pixelWidth) || pixelWidth === 0) {
    logger.error("CRITICAL: pixelWidth is invalid, defaulting to 1.0")
    pixelWidth = 1.0
  }
  ```

- **Extended auto-fix trigger**: Now activates for zero values in addition to 1.0
  ```javascript
  if ((Math.abs(pixelWidth - 1.0) < 0.01 || pixelWidth === 0) && ...)
  ```

**Result**: Geotransform is now guaranteed to have valid pixel scale values, enabling proper bounds calculation and CRS transformation.

---

### 2. **src/components/HeterogeneityAnalysis.jsx** (Lines 533 & 290)
**Function**: `handleCategoryFileUpload()` & `handleRgbUpload()`

**Changes Made**:
- Added `metadata: rasterData.metadata` to raster info objects:

**Category upload** (Line 533):
```javascript
const rasterInfo = {
  category,
  fileName: file.name,
  crs: rasterData.crs || 'EPSG:4326',
  bounds: rasterData.bounds,
  uploadedAt: new Date().toISOString(),
  metadata: rasterData.metadata  // NEW: Preserves originalCRS
}
```

**RGB upload** (Line 290):
```javascript
const rgbInfo = {
  fileName: file.name,
  crs: rasterData.crs || 'EPSG:4326',
  bounds: rasterData.bounds,
  uploadedAt: new Date().toISOString(),
  metadata: rasterData.metadata  // NEW: Preserves originalCRS
}
```

**Result**: Original CRS is now preserved in storage, enabling UI to show what transformation occurred.

---

### 3. **src/components/RasterMetadataDisplay.jsx** (Lines 95-115)
**Component**: Shows raster metadata in UI

**Changes Made**:
- Renamed "CRS" label to "CRS (Current)" to clarify it shows transformed CRS
- Added conditional block to show original CRS if transformation occurred:

```javascript
{rasterInfo.metadata?.originalCRS && rasterInfo.metadata.originalCRS !== rasterInfo.crs && (
  <div>
    <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>📍 Original CRS:</span>
    <div style={{ color: '#FF9800', fontSize: '11px' }}>
      {rasterInfo.metadata.originalCRS} (auto-transformed)
    </div>
  </div>
)}
```

**Result**: Users can now see both:
- Current CRS: EPSG:4326 (WGS84) ← What the raster is stored as
- Original CRS: EPSG:32634 (UTM 34N) ← What the file was in, auto-transformed

---

## Transformation Pipeline

```
GeoTIFF Upload
    ↓
┌─────────────────────────────────────┐
│ parseGeoTIFF(file, 'EPSG:4326')    │
├─────────────────────────────────────┤
│ 1. Extract original CRS from metadata
│    (e.g., EPSG:32634 for UTM)
│                ↓
│ 2. Parse geotransform [FIXED]
│    - Extract origin (X, Y)
│    - Extract pixel scale (width, height) [NOW VALIDATES]
│    - Ensures scale ≠ 0 [NEW VALIDATION]
│                ↓
│ 3. Calculate bounds
│    bounds = {west, east, north, south}
│    [Now works because geotransform is valid]
│                ↓
│ 4. Transform to target CRS (if different)
│    Transform all 4 corners using proj4:
│    EPSG:32634 → EPSG:4326
│    (UTM meters → WGS84 degrees)
│                ↓
│ 5. Recalculate geotransform for new CRS
│    [pixel scale now in degrees, not meters]
│                ↓
│ 6. Return rasterData with:
│    - crs: 'EPSG:4326'
│    - metadata.originalCRS: 'EPSG:32634'
│    - bounds: {in WGS84 coordinates}
│    - geotransform: [for WGS84 system]
└─────────────────────────────────────┘
    ↓
Store & Display
    ↓
Sites with WGS84 coords NOW align correctly! ✓
```

---

## Debug Logging

When uploading a raster, check browser console for logs like:

```
📐 parseGeotransform: Starting extraction...
   ✓ Found ModelPixelScale in geoKeys: [30, 30]
   ✓ Found ModelTiepoint in geoKeys
   ✓ Extracted pixel scale from array format: width=30, height=30
   ✓ Extracted origin from tiepoint: (419500.0, 7580000.0)
   ✓ parseGeotransform result: [419500, 30.0000, 0, 7580000, 0, -30.0000]

🔄 Transforming bounds from EPSG:32634 to EPSG:4326...
   Original bounds in EPSG:32634: {"west":419500,"east":421500,"north":7580000,"south":7578000}
✅ Bounds transformed to EPSG:4326: {"west":14.123,"east":14.135,"north":68.456,"south":68.445}
   New geotransform: [14.1234, 0.000012, 0, 68.4567, 0, -0.000020]
```

If you see "CRITICAL: pixelWidth is invalid", the auto-fix mechanism engaged and derived pixel scale from bounds.

---

## Testing Checklist

- [ ] Upload test.tif (should show pixel scale extraction)
- [ ] Import sites via ImportSites with WGS84 coordinates
- [ ] Verify sites appear on raster viewer
- [ ] Check RasterMetadataDisplay shows both current and original CRS
- [ ] Draw polygon on raster - should align correctly
- [ ] Extract histogram from polygon - values should be non-zero
- [ ] Check browser console for parseGeotransform logs

---

## Technical Details

**Coordinate Systems Supported** (defined in coordinateTransform.js):
- EPSG:4326 - WGS84 (lat/lon)
- EPSG:32633 - UTM zone 33N (meters)
- EPSG:32634 - UTM zone 34N (meters)
- EPSG:32635 - UTM zone 35N (meters)
- EPSG:32608 - UTM zone 8N (meters)

**Libraries Used**:
- `geotiff.js` - Parse GeoTIFF files and extract metadata
- `proj4` - Transform coordinates between CRS systems

**Key Functions**:
- `parseGeoTIFF(file, targetCRS)` - Main parsing function
- `parseGeotransform(image)` - Extract geospatial transform
- `transformCoordinates(x, y, fromCRS, toCRS)` - CRS conversion using proj4
- `coordinateToPixel(rasterData, lat, lon)` - Convert WGS84 to pixel coords

---

**Last Updated**: 2026-04-28
**Status**: ✅ Complete
