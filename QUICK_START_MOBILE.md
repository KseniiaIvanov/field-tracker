# Quick Start: Using Field Campaign Tracker on Mobile

## 🚀 Fastest Way (No Installation Required)

### On iPhone (Safari):
1. Open Safari
2. Visit: `https://your-domain.com` (or `http://localhost:5173` for testing)
3. Tap **Share** button (arrow pointing up)
4. Tap **Add to Home Screen**
5. Name it "Field Tracker" and tap **Add**

### On Android (Chrome):
1. Open Chrome
2. Visit: `https://your-domain.com` (or `http://localhost:5173` for testing)
3. Tap **⋮** (menu) → **Install app**
4. Tap **Install**

## ✨ What You Get

Offline-capable field research app with:
- 📍 GPS location tracking
- 📸 Photo with EXIF GPS extraction
- 📊 Real-time statistics
- 📤 Data export (CSV)
- 💾 Works without internet
- 🌙 Dark mode support
- 📱 Touch-optimized UI

## 📝 Typical Field Workflow

1. **Launch the app** from home screen
2. **Create Entry** → Select date, enter GPS, add photo
3. **Record Data** → Fill in soil moisture, vegetation, weather
4. **Save & Next** → Auto-increments site number
5. **Repeat** → Same process for next site
6. **Back at Camp** → Export data as CSV

## 🔧 Local Testing (Before Deployment)

### On Your Computer:
```bash
npm run dev
# Visit: http://localhost:5173
```

### On Mobile (Same WiFi):
```bash
# Find your computer's IP
# macOS/Linux:
ifconfig | grep "inet " | grep -v 127

# Then on mobile, visit: http://192.168.X.X:5173
```

### Remote Testing:
```bash
# Install ngrok: https://ngrok.com
npm run dev

# In another terminal:
ngrok http 5173

# Share the URL with team members
```

## 📱 Installing on Different Devices

### iPhone 13+ (Any iOS 15+):
- Open Safari
- Add to Home Screen (pin icon in toolbar)
- Works best with HTTPS

### iPhone 12 and Older:
- Same process, works fully
- May need iOS 14+

### Android 8+:
- Chrome recommended
- Google Assistant integration available
- Can also use Firefox or Edge

### Offline Mode:
- App automatically caches data
- Works without internet after first load
- Photos and files stored locally
- Sync when back online

## 🔐 Data Privacy

- All data stays on your device
- Nothing sent to external servers
- Export locally to USB/email
- No cloud storage required

## ⚙️ Device Settings

### Enable Required Permissions:
When prompted by the app, allow:
- ✅ Camera access (for photo EXIF GPS)
- ✅ Location access (for GPS tracking)
- ✅ File access (for importing data)

### iOS Settings:
```
Settings → Field Tracker → 
  ✓ Camera
  ✓ Location (While Using)
```

### Android Settings:
```
Settings → Apps → Field Tracker →
  ✓ Permissions → Camera
  ✓ Permissions → Location
```

## 🐛 Troubleshooting

### "Install button doesn't appear"
- Use Chrome on Android (Safari on iOS has limited PWA)
- Ensure HTTPS is enabled
- Try different browser (Firefox, Edge)

### "Location not working"
- Check location permission in device settings
- Enable high-accuracy location (if available)
- Requires HTTPS on iOS

### "Photos not saving"
- Check camera permission
- Ensure app has storage access
- Try using system file picker instead

### "Offline mode not working"
- Service Worker must load first time online
- Force refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Android)
- Clear site data in app settings

## 📊 Keyboard Shortcuts (Desktop/Tablet)

- `Tab` → Navigate fields
- `Enter` → Save entry
- `Esc` → Back to menu
- `D` → Dark mode toggle (mobile menu)

## 💾 Backing Up Data

### Automatic:
- Data stored locally on device
- Backup phone/tablet regularly

### Manual:
1. App Menu → Data Management → Export
2. Save CSV file to cloud
3. Share via email or USB

## 🌐 Deploying Your Own Server

### Free Options:
- **Vercel**: Free for PWA apps, automatic HTTPS
- **Netlify**: Drag & drop deployment, auto HTTPS
- **GitHub Pages**: Free hosting, HTTPS included

### Step-by-Step (Vercel):
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Follow prompts
# Your app will be live!
```

Visit your deployment URL from mobile to install.

## 📞 Support

**Common Issues:** Check browser console (F12) for error messages

**Cannot find manifest.json:**
- Ensure HTTPS is used
- Check browser DevTools → Application → Manifest

**Service Worker errors:**
- Clear cache and reload
- Check DevTools → Application → Service Workers

## Next Steps

1. ✅ Test on your phone (offline mode)
2. ✅ Generate proper app icons (see ICON_GENERATION.md)
3. ✅ Deploy to HTTPS domain
4. ✅ Share with field team

Your field tracker is ready for the Arctic! 🏔️❄️
