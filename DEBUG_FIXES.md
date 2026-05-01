# Debugging Fixes for Vegetation/Disturbance Rasters

## Problem
Vegetation and Disturbance rasters weren't displaying site markers and polygons, while Moisture and RGB rasters worked correctly.

## Root Causes Identified & Fixed

### 1. Missing Raster Data on Page Reload
**Issue**: When users saved rasters and then refreshed the page:
- `rastersByCategory` was loaded from localStorage (showing saved metadata)
- BUT `rasterDataCache` remained empty (pixel data not loaded)
- RasterStack's filter `rastersByCategory[key] && rasterDataCache[key]` would exclude those categories
- No rasters would display until new ones were uploaded

**Fix**: Added `useEffect` in HeterogeneityAnalysis.jsx (lines 87-107) to:
- Detect when `rastersByCategory` is populated from storage
- Load each category's raster data from IndexedDB/localStorage into `rasterDataCache`
- Ensure all saved rasters are available on page load

### 2. Insufficient Diagnostic Logging
**Issue**: When sites/polygon didn't render, there was no clear indication of why:
- Was the raster loaded? (no log)
- Did it have proper CRS metadata? (no log)
- Did coordinate transformation fail? (silent failure)
- Were overlays out of bounds? (vague logging)

**Fixes**:

#### RasterStack.jsx
- Shows which categories are in metadata vs cache with CRS information
- Detailed logging of why each category passes or fails the render filter
- Format: "category: byCategory=true, cache=true, crs=EPSG:4326, will render=true"

#### RasterViewer.jsx - Sites Rendering
- Logs raster CRS and dimensions before attempting to draw sites
- Separates error types:
  - Invalid input coordinates (NaN/Infinity)
  - Coordinate transformation errors (caught and logged)
  - Transform results that are NaN
  - Out-of-bounds pixels (with exact pixel positions)
- Shows transformation error messages explicitly

#### RasterViewer.jsx - Polygon Rendering
- Same enhanced logging as sites
- Tracks polygon points out-of-bounds separately
- Shows first polygon point issues in detail

## Testing the Fixes

### 1. Open Browser Console
Press F12, go to Console tab

### 2. After Page Load
You should see logs like:
```
🔍 RasterStack: rgbDataCache=true, rasterDataCache keys=moisture,vegetation,disturbance, allEntries=15, polygon=yes
  Renderable categories: [moisture, vegetation, disturbance]
    moisture: byCategory=true, cache=true, crs=EPSG:4326, will render=true
    vegetation: byCategory=true, cache=true, crs=EPSG:4326, will render=true
    disturbance: byCategory=true, cache=true, crs=EPSG:4326, will render=true
  📂 Loading saved category rasters into cache...
    Loading moisture...
    ✓ Successfully loaded moisture
```

### 3. When Viewing a Raster
You should see detailed overlay rendering logs:
```
🎯 Drawing 15 sites on raster (CRS=EPSG:4326, width=852, height=589)
  Sites: 12/15 drawn (3 out of bounds, 0 errors)

🔷 Drawing polygon with 8 points on raster (CRS=EPSG:4326)
  Polygon: 8/8 points drawn (0 out of bounds)
```

Or if there are problems:
```
🎯 Drawing 15 sites on raster (CRS=EPSG:4326, width=852, height=589)
  Site 0: Transform error: Invalid geotransform matrix! det=0
Transform errors: Invalid geotransform matrix! det=0
  Sites: 0/15 drawn (15 errors, 0 out of bounds)
```

## What These Logs Tell You

| Log Message | Meaning |
|---|---|
| `cache=false` | Raster data not loaded (auto-loads on next refresh) |
| `crs=EPSG:4326` | Raster CRS detected correctly |
| `Transform error` | Coordinate conversion failed (check geotransform) |
| `Transform produced NaN` | CRS transformation returned invalid coordinates |
| `OUT OF BOUNDS` | Sites/polygon coordinates outside raster bounds |
| `0/15 drawn` | No overlays rendered (check error details above) |

## Next Steps If Still Seeing Issues

1. **Upload a new raster** - Check console for parsing logs
2. **Share the console output** - Look for transform errors or missing CRS
3. **Check raster bounds** - Compare raster extent with site coordinates
4. **Verify CRS consistency** - All should be EPSG:4326 or same projection

## Files Modified

- `HeterogeneityAnalysis.jsx` - Added auto-load for saved rasters
- `RasterStack.jsx` - Enhanced diagnostic logging
- `RasterViewer.jsx` - Detailed error tracking for overlays
