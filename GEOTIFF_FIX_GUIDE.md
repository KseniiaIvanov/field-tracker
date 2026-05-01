# 🛠️ How to Fix Your GeoTIFF Files

## The Problem

Your GeoTIFF files (like veg_height.tif) have geotransform metadata in GDAL format, but the browser library (`geotiff.js`) cannot read it properly.

**GDAL reads it fine:**
```
Origin = (419216.008, 7584186.875)
Pixel Size = (10.0298, 10.0573)
CRS = EPSG:32634
```

**geotiff.js reads it wrong:**
```
Origin = (19.04, 68.36)  ← WGS84 corner only
Pixel Size = (0, 0)      ← LOST!
```

## The Solution

**Regenerate your GeoTIFF files with GDAL** to make them compatible with geotiff.js.

This is a one-time process - do it once per file, then upload the fixed version.

---

## Step 1: Install GDAL (if not already installed)

### macOS (using Homebrew)
```bash
brew install gdal
```

### Ubuntu/Debian
```bash
sudo apt-get install gdal-bin
```

### Windows
Download from [OSGeo4W](https://trac.osgeo.org/osgeo4w/) or use [conda](https://docs.conda.io/):
```bash
conda install gdal
```

### Verify installation
```bash
gdalinfo --version
gdal_translate --version
```

---

## Step 2: Regenerate Your GeoTIFF Files

For **each GeoTIFF file** you want to use, run:

```bash
gdal_translate -of GTiff -co COMPRESS=DEFLATE \
  "/path/to/original_file.tif" \
  "/path/to/original_file_FIXED.tif"
```

### Example (your specific file):

```bash
gdal_translate -of GTiff -co COMPRESS=DEFLATE \
  "/Users/kseniiaivanova/Library/Mobile Documents/com~apple~CloudDocs/MPI/Abisko2025/GIS/test/veg_height.tif" \
  "/Users/kseniiaivanova/Library/Mobile Documents/com~apple~CloudDocs/MPI/Abisko2025/GIS/test/veg_height_FIXED.tif"
```

### Batch processing (all TIF files in a directory)

macOS/Linux:
```bash
cd /your/tiff/directory
for file in *.tif; do
  gdal_translate -of GTiff -co COMPRESS=DEFLATE "$file" "${file%.*}_FIXED.tif"
done
```

Windows (PowerShell):
```powershell
cd C:\your\tiff\directory
Get-ChildItem *.tif | ForEach-Object {
  gdal_translate -of GTiff -co COMPRESS=DEFLATE $_.FullName "$($_.BaseName)_FIXED.tif"
}
```

---

## Step 3: Test with the Fixed File

1. **Delete the old RGB raster** from the app (if you have one)
2. **Upload the _FIXED.tif file** to the app
3. **Check:**
   - ✅ Bounds display properly (range, not single point)
   - ✅ CRS shows as EPSG:4326 (auto-transformed)
   - ✅ Original CRS shown (EPSG:32634)
   - ✅ Sites appear on the raster
   - ✅ Polygon visible on canvas

---

## What the Fix Does

The `gdal_translate` command:
- ✅ Reads the file properly with GDAL
- ✅ Re-encodes the geotransform in standard GeoTIFF format
- ✅ Preserves all geospatial data (CRS, bounds, pixel scale)
- ✅ Makes the output compatible with `geotiff.js` (browser library)
- ✅ Compresses with DEFLATE for smaller file size

---

## Why This is Necessary

| Library | Environment | Works? | Handles Your Files? |
|---------|-------------|--------|-------------------|
| **GDAL** | Command-line / Server | ✅ | ✅ YES |
| **geotiff.js** | Browser (JavaScript) | ✅ | ❌ NO (reads metadata wrong) |

- This app runs in your **browser** (client-side only)
- Only JavaScript libraries work in browser
- `geotiff.js` is the only GeoTIFF library for browsers
- It needs metadata in specific format
- `gdal_translate` converts your files to that format

---

## Troubleshooting

### "gdal_translate: command not found"
→ GDAL is not installed or not in your PATH
→ Re-run installation command for your OS

### File size doubled after running gdal_translate
→ Normal! The output might be larger depending on compression
→ You can delete the original and use the _FIXED version

### Coordinates still wrong after upload
→ Clear browser cache: F12 → Application → Clear Storage
→ Hard refresh: Cmd+Shift+R
→ Delete old raster and re-upload the _FIXED version

### "Invalid GeoTIFF" error in app
→ The file might be corrupt
→ Try opening it in QGIS first to verify it's valid
→ Run gdalinfo to check:
```bash
gdalinfo your_file.tif
```

---

## What NOT to Do

❌ Don't upload unregenerated files - metadata won't be read
❌ Don't use 3rd party online GeoTIFF tools - trust GDAL
❌ Don't mix old and new versions - always use _FIXED
❌ Don't assume it will work without regenerating - it won't

---

## Questions?

If you get an error during regeneration:
1. Run: `gdalinfo your_file.tif` and check the output
2. Make sure file path is correct (use quotes around paths with spaces)
3. Try with the full absolute path (not relative path)

Once you have GDAL installed and run `gdal_translate` once, all future uploads will work! 🎉
