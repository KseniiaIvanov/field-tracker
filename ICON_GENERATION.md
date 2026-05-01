# Generating App Icons

The Field Campaign Tracker uses SVG icons that need to be converted to PNG for different devices.

## Quick Method: Online Tool

1. Go to https://www.pwabuilder.com/imageGenerator
2. Upload `public/icon.svg`
3. Generate all sizes (PWA Image Generator will create them automatically)
4. Download ZIP file
5. Extract files to `public/` directory

This generates:
- icon-192.png (192x192)
- icon-512.png (512x512)
- icon-maskable-192.png (192x192 with safe zone)
- icon-maskable-512.png (512x512 with safe zone)
- apple-touch-icon.png (180x180 for iOS)

## Local Method: ImageMagick

### Install ImageMagick

**macOS:**
```bash
brew install imagemagick
```

**Linux (Ubuntu):**
```bash
sudo apt-get install imagemagick
```

**Windows:**
Download from https://imagemagick.org/script/download.php

### Generate Icons

```bash
cd /Users/kseniiaivanova/Downloads/field_diary

# Create icon directory
mkdir -p public/icons

# Generate standard icons
convert public/icon.svg -resize 192x192 -background white -alpha remove public/icon-192.png
convert public/icon.svg -resize 512x512 -background white -alpha remove public/icon-512.png

# For iOS
convert public/icon.svg -resize 180x180 -background white -alpha remove public/apple-touch-icon.png

# Generate maskable icons (for adaptive icons on Android)
convert public/icon.svg -resize 192x192 -background none public/icon-maskable-192.png
convert public/icon.svg -resize 512x512 -background none public/icon-maskable-512.png
```

## Icons Needed

| Size | Purpose | File Name |
|------|---------|-----------|
| 192x192 | Android home screen | `icon-192.png` |
| 512x512 | App store/splash | `icon-512.png` |
| 192x192 | Android adaptive (maskable) | `icon-maskable-192.png` |
| 512x512 | Android adaptive (maskable) | `icon-maskable-512.png` |
| 180x180 | iOS home screen | `apple-touch-icon.png` |

## Splash Screens (Optional but Recommended)

Create splash screens for app launch:

```bash
# Narrow (mobile)
convert public/icon.svg -resize 270x360 -background "#1976d2" -gravity center \
  -extent 540x720 public/screenshot-1.png

# Wide (tablet)
convert public/icon.svg -resize 360x480 -background "#1976d2" -gravity center \
  -extent 1280x720 public/screenshot-2.png
```

## Verify Icons

After generating icons, verify they exist:

```bash
ls -la /Users/kseniiaivanova/Downloads/field_diary/public/*.png
```

Expected output:
```
-rw-r--r--  apple-touch-icon.png
-rw-r--r--  icon-192.png
-rw-r--r--  icon-512.png
-rw-r--r--  icon-maskable-192.png
-rw-r--r--  icon-maskable-512.png
```

## Testing Icons

After generating icons:

1. **Build the app:**
   ```bash
   npm run build
   ```

2. **Preview in browser:**
   ```bash
   npm run preview
   ```

3. **Check manifest.json is being served:**
   - Open DevTools (F12)
   - Go to Application → Manifest
   - Should show all icons

4. **Test installation (Android):**
   - Open in Chrome
   - Look for "Install app" button
   - Icons should appear in install prompt

5. **Test installation (iOS):**
   - Open in Safari
   - Tap Share → Add to Home Screen
   - Icon should appear (uses apple-touch-icon.png)

## Troubleshooting

**Icons not appearing in install dialog:**
- Icons must be PNG (not SVG)
- Check icon dimensions match manifest.json
- Clear browser cache (Ctrl+Shift+Del or Cmd+Shift+Delete)
- Verify manifest.json is at `/manifest.json`

**Blurry icons:**
- Icons must be perfect squares
- Generate at exact sizes listed above
- Use `-background white -alpha remove` for clean backgrounds

**iOS icon looks different:**
- iOS rounds all corners automatically
- iOS uses 180x180 (apple-touch-icon.png)
- iOS may add gloss effect (configurable)

## Icon Design Notes

The current SVG icon includes:
- Blue gradient background (#1976d2 → #1565c0)
- Map pin (GPS location)
- Data points and connecting lines
- Clean, simple design that scales well

For better app store presentation, consider:
- Custom icon designer feedback
- User testing on small sizes
- Ensuring contrast is high for readability

## Automation Script

Create `generate-icons.sh` to automate icon generation:

```bash
#!/bin/bash

echo "Generating icons from SVG..."

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "ImageMagick not found. Install with: brew install imagemagick"
    exit 1
fi

cd "$(dirname "$0")"

# Generate icons
convert public/icon.svg -resize 192x192 -background white -alpha remove public/icon-192.png
convert public/icon.svg -resize 512x512 -background white -alpha remove public/icon-512.png
convert public/icon.svg -resize 192x192 -background none public/icon-maskable-192.png
convert public/icon.svg -resize 512x512 -background none public/icon-maskable-512.png
convert public/icon.svg -resize 180x180 -background white -alpha remove public/apple-touch-icon.png

echo "✓ Icons generated successfully!"
ls -lh public/{icon-*,apple-touch-icon}.png
```

Save as `generate-icons.sh` and run:
```bash
chmod +x generate-icons.sh
./generate-icons.sh
```
