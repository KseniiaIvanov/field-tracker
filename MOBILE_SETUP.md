# Mobile Setup Guide - Field Campaign Tracker

This guide covers deploying Field Campaign Tracker as a mobile app on iOS and Android.

## Option 1: Progressive Web App (PWA) - Easiest

The app is already configured as a PWA. Users can install it directly from the browser on both iOS and Android.

### Installation Instructions

#### **Android:**
1. Open the app in Chrome
2. Tap the three-dot menu → "Install app" or "Add to Home screen"
3. The app will install as a standalone app with offline support

#### **iOS (Safari):**
1. Open the app in Safari
2. Tap the Share button → "Add to Home Screen"
3. The app will appear on the home screen as a web clip

### What's Included:
- ✅ Service Worker for offline support
- ✅ Local storage persistence (IndexedDB)
- ✅ Camera access (via file input)
- ✅ Geolocation support
- ✅ Touch-optimized UI (44px minimum tap targets)
- ✅ Safe area support for notched devices
- ✅ App icon and splash screens
- ✅ Startup URL shortcuts (New Entry, Statistics)

### Limitations:
- No background sync (data syncs when app opens)
- No push notifications (yet)
- iOS: Limited background geolocation

---

## Option 2: Native App (iOS/Android) - Capacitor

For native app distribution through App Store/Play Store, use Capacitor.

### Installation

```bash
cd /Users/kseniiaivanova/Downloads/field_diary

# Install Capacitor
npm install -D @capacitor/core @capacitor/cli
npm install @capacitor/app @capacitor/device @capacitor/filesystem @capacitor/camera @capacitor/geolocation

# Initialize Capacitor
npx cap init field-tracker "Field Campaign Tracker"
```

### Build for Native

```bash
# Build the web app first
npm run build

# Add iOS
npx cap add ios

# Add Android
npx cap add android

# Sync changes
npx cap sync
```

### iOS Deployment

```bash
# Open Xcode
npx cap open ios

# In Xcode:
# 1. Select "Field Campaign Tracker" as target
# 2. Set your Team ID (Signing & Capabilities)
# 3. Build & Run on device or simulator
# 4. Archive and upload to App Store
```

**Important iOS configurations:**
- Add camera usage description in `ios/App/App/Info.plist`:
  ```xml
  <key>NSCameraUsageDescription</key>
  <string>We need camera access to extract GPS coordinates from photos</string>
  <key>NSLocationWhenInUseUsageDescription</key>
  <string>We need your location to record field measurement coordinates</string>
  ```

### Android Deployment

```bash
# Open Android Studio
npx cap open android

# In Android Studio:
# 1. Select device/emulator
# 2. Build → Build Bundle(s) / APK(s)
# 3. Upload to Google Play Console
```

**Important Android configurations (already in build):**
- Uses Gradle with API 30+
- Permissions in `android/app/src/main/AndroidManifest.xml`:
  ```xml
  <uses-permission android:name="android.permission.CAMERA" />
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
  <uses-permission android:name="android.permission.INTERNET" />
  ```

---

## Option 3: Quick Testing on Mobile

### Local Network Testing

```bash
# Find your local IP
ifconfig | grep "inet " | grep -v 127.0.0.1

# Start dev server (will show available URLs)
npm run dev

# On mobile device, connect to same WiFi
# Visit: http://YOUR_IP:5173
```

### Using ngrok for Remote Testing

```bash
# Install ngrok: https://ngrok.com

# Start dev server
npm run dev

# In another terminal
ngrok http 5173

# Visit the provided ngrok URL on mobile
```

---

## Feature Support Matrix

| Feature | PWA | iOS Native | Android Native |
|---------|-----|-----------|----------------|
| GPS/Geolocation | ✅ | ✅ | ✅ |
| Camera | ✅ | ✅ | ✅ |
| EXIF Data Reading | ✅ | ✅ | ✅ |
| Photo Gallery Upload | ✅ | ✅ | ✅ |
| File Import (CSV/Excel) | ✅ | ✅ | ✅ |
| Offline Support | ✅ | ✅ | ✅ |
| Data Export | ✅ | ✅ | ✅ |
| Push Notifications | ❌ | ⏳ | ⏳ |
| Background Sync | ❌ | ⏳ | ⏳ |
| Home Screen Widgets | ❌ | ❌ | ⏳ |

---

## Mobile-Specific Optimizations

### Implemented:
- ✅ Touch-friendly button sizing (min 44px)
- ✅ Disabled double-tap zoom on inputs
- ✅ Safe area support for notched devices
- ✅ -webkit-overflow-scrolling for smooth iOS scrolling
- ✅ Responsive grid layouts (collapse to 1 column on mobile)
- ✅ Proper font-size (16px minimum to prevent auto-zoom)
- ✅ Input appearance override for consistent styling

### Network Optimization:
- Service Worker caches static assets
- Network-first strategy for HTML
- Cache-first strategy for images/assets
- ~2.5MB app size (gzipped)

---

## Deployment Checklist

### For PWA:
- [ ] Generate PNG icons from SVG:
  - [ ] 192x192 (icon-192.png)
  - [ ] 512x512 (icon-512.png)
  - [ ] 192x192 maskable (icon-maskable-192.png)
  - [ ] 512x512 maskable (icon-maskable-512.png)
- [ ] Create splash screens:
  - [ ] 540x720 (screenshot-1.png)
  - [ ] 1280x720 (screenshot-2.png)
- [ ] Test on iOS Safari (install button may not appear)
- [ ] Test on Android Chrome (install button should appear)
- [ ] Deploy to HTTPS domain
- [ ] Verify service worker registration
- [ ] Test offline functionality

### For Native Apps:
- [ ] Create Capacitor project
- [ ] Configure app icons and splash screens
- [ ] Add camera/location permissions
- [ ] iOS: Configure signing
- [ ] iOS: Build and test on device
- [ ] Android: Configure signing key
- [ ] Android: Build release APK/AAB
- [ ] iOS: Submit to App Store
- [ ] Android: Submit to Play Store

---

## Generating Icons (Easy Method)

Use an online tool to generate icons from the SVG:
1. Visit: https://www.pwabuilder.com/imageGenerator
2. Upload `/public/icon.svg`
3. Generate all sizes
4. Download and place in `/public/`

Or use ImageMagick locally:
```bash
# Install ImageMagick
brew install imagemagick

# Generate from SVG
convert public/icon.svg -resize 192x192 public/icon-192.png
convert public/icon.svg -resize 512x512 public/icon-512.png
```

---

## Production Deployment

### Recommended Hosting:
- **Static Hosting**: Vercel, Netlify, GitHub Pages (free, easy PWA)
- **Custom Server**: Node.js + Express (HTTPS required for PWA)
- **Docker**: Containerize and deploy anywhere

### Example Docker Setup:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

### Important: HTTPS Required
- PWA features (service worker, geolocation) require HTTPS
- Get free HTTPS from Let's Encrypt
- CDN providers (Cloudflare, etc.) auto-provide HTTPS

---

## Troubleshooting

### App Not Installing (Android)
- Check HTTPS is working
- Verify manifest.json is accessible
- Check service worker registration in console

### App Not Installing (iOS)
- iOS PWA support is more limited
- Use Safari (not Chrome)
- Install dialog may be hidden, check "Add to Home Screen"
- For full features, use native app with Capacitor

### Service Worker Not Updating
- Hard refresh: Cmd+Shift+R (Ctrl+Shift+R on Windows)
- Clear site data in Settings
- Check service worker scope in DevTools

### Offline Not Working
- Service worker must be registered
- Check DevTools → Application → Service Workers
- Verify HTTPS is used

---

## Next Steps

1. **Immediate**: Test PWA on iOS and Android
2. **Short-term**: Generate proper app icons
3. **Medium-term**: Set up Capacitor for native apps
4. **Long-term**: App Store/Play Store submission

For questions, check browser console (F12) for errors.
