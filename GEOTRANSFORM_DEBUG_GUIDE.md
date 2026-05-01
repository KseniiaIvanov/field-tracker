# 🔍 GeoTIFF Geotransform Debug Guide

## The Issue
Your veg_height.tif upload shows **degenerate bounds** (single point):
```
Lat (N-S): [68.36, 68.36]  ← Should be different
Lon (W-E): [19.04, 19.04]  ← Should be different
```

This means the geotransform still has **zero pixel scale values**, even after my fixes.

## Testing Steps

### 1. **Open Browser Developer Console**
- Press **F12** or **Cmd+Option+I** (Mac)
- Go to **Console** tab
- Keep it open during upload

### 2. **Upload veg_height.tif Again**
1. Go to "Heterogeneity Analysis"
2. Click "Upload Raster for Moisture" (or any category)
3. Select veg_height.tif

### 3. **Look for These Logs in Console**

**Good output (pixel scale extracted successfully):**
```
📐 parseGeotransform: Starting extraction...
   ✓ Found ModelPixelScale in geoKeys: [30,30]
   Raw PixelScale array values: [30, 30]
      ✓ Using PixelScale[0]: 30
      ✓ Using PixelScale[1]: 30
   ✓ Extracted pixel scale from array format: width=30, height=30

✓ parseGeotransform FINAL result:
    Origin: (419500.0, 7580000.0)
    Pixel scale: width=30.000000, height=30.000000
    Full geotransform: [419500.0, 30.000000, 0, 7580000.0, 0, -30.000000]
```

**Bad output (pixel scale extraction failed):**
```
📐 parseGeotransform: Starting extraction...
   ⚠️ No PixelScale found in any source, using default 1.0

✓ parseGeotransform FINAL result:
    Origin: (19.04, 68.36)
    Pixel scale: width=1.000000, height=1.000000  ← Still default!
```

**CRITICAL output (error thrown):**
```
❌ CRITICAL: Degenerate bounds detected!
   Bounds width: 0
   Bounds height: 0
   Geotransform: [19, 0, 0, 68, 0, -0]
```

---

## What the Logs Tell You

### If you see "No PixelScale found":
The ModelPixelScale tag is not being extracted from the GeoTIFF file. This could mean:
1. The tag doesn't exist in this file
2. It's in a format the code doesn't recognize
3. The file is corrupt

**Action**: Run `gdalinfo veg_height.tif` in terminal to check if the file has pixel scale metadata:
```bash
gdalinfo veg_height.tif | grep -A5 "Pixel"
```

Look for lines like:
```
Pixel Scale = (30.000000,30.000000,0.000000)
```

### If you see "Using PixelScale[0]: 0":
The file HAS pixel scale metadata, but the values are zero. This is unusual and indicates:
1. The file's geotransform was created incorrectly
2. Or the file is corrupt

**Action**: Contact the GIS team that created the file - it needs to be regenerated with proper geotransform.

### If you see "Degenerate bounds detected":
This is the error you're hitting. The bounds have collapsed to a single point. Either:
1. Pixel scale is zero
2. Image dimensions are zero
3. Origin is NaN

**Debug**: Check what the actual geotransform values are. They should NOT be:
- `[19, 0, 0, 68, 0, -0]` ← Zero pixel scales (WRONG)
- `[NaN, ..., ..., NaN, ..., ...]` ← NaN values (WRONG)

---

## Diagnostic Steps

### Step 1: Check the Raw File
```bash
# Get detailed GDAL info
gdalinfo veg_height.tif

# Look specifically for:
# - Coordinate System (should show EPSG:32634 or similar)
# - Geotransform (should NOT have 0 values)
# - Pixel Scale (should be non-zero)
```

### Step 2: Check GeoTIFF Tags
```bash
# List all TIFF tags (requires ImageMagick)
identify -verbose veg_height.tif | grep -i "geometry\|resolution\|tiff"

# Or with gdal (better):
gdaltranslate -co COPY_SRC_OVERVIEWS=YES -co COMPRESS=DEFLATE \
  -of COG veg_height_fixed.tif veg_height.tif
```

### Step 3: Manually Check the Metadata
```python
# In Python with rasterio
import rasterio

with rasterio.open('veg_height.tif') as src:
    print("CRS:", src.crs)
    print("Transform:", src.transform)
    print("Bounds:", src.bounds)
    print("Size:", src.width, "x", src.height)
```

---

## Common Causes and Fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Pixel scale: width=1.0, height=1.0` | No metadata | Regenerate GeoTIFF with proper georeferencing |
| `Pixel scale: width=0, height=0` | Corrupt metadata | Re-georeference the file with GDAL |
| `Degenerate bounds` | Bad geotransform | Use `gdal_translate` to fix |
| `CRS detected: EPSG:4326` but should be EPSG:32634 | File has wrong CRS | Reproject with `gdalwarp` |

### Regenerate GeoTIFF with Correct Metadata
```bash
# If you know the correct bounds and CRS:
gdal_translate \
  -a_srs EPSG:32634 \
  -a_ullr 419000 7581000 421000 7579000 \
  veg_height.tif veg_height_fixed.tif

# Then upload veg_height_fixed.tif to the app
```

---

## Debugging Browser Logs

### Filter for rasterProcessing logs:
1. **In Console, type:**
   ```javascript
   // Filter to show only rasterProcessing logs
   localStorage.setItem('log_enabled_rasterProcessing', 'true')
   localStorage.setItem('log_enabled_HeterogeneityAnalysis', 'true')
   
   // Then reload and upload
   location.reload()
   ```

2. **Upload veg_height.tif**

3. **In Console, all messages starting with `[rasterProcessing]` are your debug logs**

### Copy console logs for analysis:
```javascript
// In console, get all messages
copy(document.body.innerText)
// Then paste to a text file
```

---

## Expected Behavior After Fix

When you upload a properly formatted UTM GeoTIFF (like veg_height.tif should be):

1. **parseGeotransform finds pixel scale:**
   ```
   ✓ Found ModelPixelScale in geoKeys
   Pixel scale: width=30.000000, height=30.000000
   ```

2. **Bounds are calculated correctly:**
   ```
   📏 Bounds dimensions: width=2000.000000, height=2000.000000
   ✓ Bounds: west=419000.0000, east=421000.0000, north=7581000.0000, south=7579000.0000
   ```

3. **Transformation succeeds:**
   ```
   🔄 Transforming bounds from EPSG:32634 to EPSG:4326...
   ✅ Bounds transformed to EPSG:4326: {"west":14.1234,"east":14.1356,"north":68.3567,"south":68.3489}
   ```

4. **RasterMetadataDisplay shows:**
   ```
   🗺️ CRS (Current): EPSG:4326
   📍 Original CRS: EPSG:32634 (auto-transformed)
   📦 Bounds: Lat (N-S): [68.35, 68.36], Lon (W-E): [14.12, 14.14]
   ```

5. **Sites appear on map! ✓**

---

## Next Steps

1. **Run the diagnostic commands above** to check your veg_height.tif file
2. **Share the gdalinfo output** - that will show exactly what's in the file
3. **If pixel scale is indeed 0 in the file**, the file needs to be regenerated
4. **If pixel scale is correct**, there's a deeper bug in the geotransform extraction logic

---

**Note**: If you have access to the original geotiff creation tool or script, share that too - it might reveal why the pixel scale is missing.
