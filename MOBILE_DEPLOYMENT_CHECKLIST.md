# Mobile Deployment Checklist

Complete this checklist to deploy Field Campaign Tracker on iOS and Android.

## Phase 1: Prepare (Before Deployment)

### Code & Build
- [x] App builds successfully (`npm run build`)
- [x] No console errors in browser DevTools
- [x] Service Worker registration working
- [x] Manifest.json is valid and accessible
- [x] Mobile CSS optimizations complete
- [ ] All features tested on mobile device

### Assets & Icons
- [ ] Generate app icons (see ICON_GENERATION.md)
  - [ ] icon-192.png
  - [ ] icon-512.png
  - [ ] icon-maskable-192.png
  - [ ] icon-maskable-512.png
  - [ ] apple-touch-icon.png (180x180)
- [ ] Place icons in `/public/`
- [ ] Generate splash screens (optional)
  - [ ] screenshot-1.png (540x720)
  - [ ] screenshot-2.png (1280x720)

### Configuration
- [ ] Update manifest.json theme color if needed
- [ ] Verify app name and description in manifest.json
- [ ] Update index.html title if needed
- [ ] Configure app version in manifest.json

## Phase 2: Local Testing

### Development Testing
- [ ] Run `npm run dev`
- [ ] Test on desktop (F12 DevTools)
  - [ ] Check responsive design (mobile breakpoints)
  - [ ] Test dark mode toggle
  - [ ] Verify touch-friendly button sizes
- [ ] Test geolocation (allow permissions)
- [ ] Test camera (allow permissions)
- [ ] Test data entry and save
- [ ] Test offline mode:
  - [ ] Load page online
  - [ ] Enable airplane mode
  - [ ] Try to load previous page (should work)
  - [ ] Try to create new entry (should work)

### Mobile Device Testing (Local Network)
```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Get your IP
ifconfig | grep "inet " | grep -v 127

# On mobile (same WiFi):
# Visit: http://YOUR_IP:5173
```

**Checklist on Mobile:**
- [ ] Page loads without errors
- [ ] Buttons are touch-friendly (44px+ tappable area)
- [ ] Form inputs work without zoom
- [ ] GPS coordinates populate (allow location)
- [ ] Camera works (allow camera)
- [ ] Photos display correctly
- [ ] Landscape/portrait rotation works
- [ ] Notched devices (iPhone X+) work properly
- [ ] Save entry works
- [ ] Statistics display correctly
- [ ] Dark mode toggle works
- [ ] Can export data

### Network Testing
- [ ] Test with throttled connection (DevTools)
- [ ] Test on 4G/LTE
- [ ] Test on WiFi 6 if available
- [ ] Test offline data persistence

## Phase 3: Prepare for Production

### HTTPS Setup (Required for PWA)
- [ ] Domain purchased or prepared
- [ ] SSL certificate obtained
  - Options: Let's Encrypt (free), Cloudflare (free), AWS ACM (free)
- [ ] HTTPS working on domain
- [ ] Mixed content warnings resolved
- [ ] Test: https://yourdomain.com loads successfully

### Hosting Choice
Choose one:
- [ ] **Vercel** (Recommended for PWA)
  - [ ] Create account
  - [ ] Connect GitHub/GitLab
  - [ ] Deploy (automatic HTTPS)
  - [ ] Domain configured (or use *.vercel.app)

- [ ] **Netlify**
  - [ ] Create account
  - [ ] Connect repository
  - [ ] Deploy (automatic HTTPS)
  - [ ] Configure custom domain

- [ ] **Custom Server**
  - [ ] Server with HTTPS configured
  - [ ] Docker container prepared
  - [ ] Reverse proxy (nginx) configured
  - [ ] HTTPS certificate auto-renewal set up

### Pre-Deployment Testing
```bash
# Build production version
npm run build

# Preview locally
npm run preview

# On mobile:
# Visit the preview URL
# Test all features work
```

- [ ] Production build tested locally
- [ ] All features work in production build
- [ ] Performance acceptable
- [ ] No console errors

## Phase 4: Deployment

### Deploy to Production
- [ ] Push code to repository
- [ ] Build and deploy (Vercel/Netlify) or manually deploy
- [ ] Verify site loads at production URL
- [ ] Test from multiple locations (use VPN if needed)
- [ ] Verify HTTPS certificate valid

### Post-Deployment Verification
- [ ] Visit production URL on desktop
  - [ ] Manifest.json loads (DevTools → Application → Manifest)
  - [ ] Service Worker registered (DevTools → Application → Service Workers)
  - [ ] Icons appear in manifest
  - [ ] No console errors
  - [ ] Page fully functional

- [ ] Visit production URL on iOS
  - [ ] Open in Safari
  - [ ] Tap Share → Add to Home Screen
  - [ ] Verify icon appears
  - [ ] Verify app name is correct
  - [ ] Test all features

- [ ] Visit production URL on Android
  - [ ] Open in Chrome
  - [ ] Install prompt appears
  - [ ] Install and test
  - [ ] Verify icon and name

## Phase 5: Distribution (Optional - Native Apps)

### For Native App Distribution
Skip this if PWA is sufficient for your needs.

#### iOS App Store
- [ ] Set up Apple Developer account ($99/year)
- [ ] Create app certificates and signing identities
- [ ] Install Capacitor: `npm install -D @capacitor/core @capacitor/cli`
- [ ] Configure Capacitor project
- [ ] Build iOS app: `npm run build && npx cap add ios`
- [ ] Open in Xcode: `npx cap open ios`
- [ ] Configure signing (Team ID)
- [ ] Build and archive
- [ ] Upload to App Store Connect
- [ ] Complete app information
- [ ] Submit for review

#### Google Play Store
- [ ] Set up Google Play Developer account ($25 one-time)
- [ ] Create signing key
- [ ] Install Capacitor (if not done above)
- [ ] Configure Capacitor Android
- [ ] Build Android app: `npx cap add android`
- [ ] Open in Android Studio: `npx cap open android`
- [ ] Configure signing
- [ ] Build release APK/AAB
- [ ] Upload to Google Play Console
- [ ] Complete app information
- [ ] Submit for review

## Phase 6: Post-Launch

### Monitoring
- [ ] Set up analytics (optional)
- [ ] Monitor error logs
- [ ] Check Performance metrics
- [ ] Review user feedback

### Updates
- [ ] Plan update schedule
- [ ] Set up CI/CD for automatic deployments
- [ ] Version numbering scheme
- [ ] Release notes process

### User Communication
- [ ] Create documentation (link to QUICK_START_MOBILE.md)
- [ ] Prepare user guide
- [ ] Set up support channel
- [ ] Create FAQ

## Quick Status Check

| Item | Status | Notes |
|------|--------|-------|
| App builds | ✅ | `npm run build` succeeds |
| PWA configured | ✅ | manifest.json, service worker |
| Mobile CSS | ✅ | Touch-friendly, responsive |
| Assets ready | ⏳ | Icons need generation |
| Local testing | ⏳ | Test on your device |
| HTTPS ready | ⏳ | Choose hosting |
| Deployed | ⏳ | Not yet on production |
| Native apps | ⏳ | Optional, Capacitor ready |

## Helpful Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run preview         # Preview production build

# Testing
npm run lint            # Check code quality

# Icon generation
./generate-icons.sh     # Auto-generate all icons

# Capacitor (if using native apps)
npx cap init field-tracker "Field Campaign Tracker"
npx cap add ios
npx cap add android
npx cap open ios        # Open Xcode
npx cap open android    # Open Android Studio
```

## Resource Links

- **PWA Documentation**: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps
- **Service Worker**: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- **Web.dev PWA Guide**: https://web.dev/progressive-web-apps/
- **Capacitor Docs**: https://capacitorjs.com/docs
- **Vercel Deploy**: https://vercel.com/docs
- **Netlify Deploy**: https://docs.netlify.com/

## Success Criteria

Your mobile deployment is successful when:

- ✅ App installs on iOS (Safari "Add to Home Screen")
- ✅ App installs on Android (Chrome "Install app")
- ✅ Offline mode works (airplane mode test)
- ✅ GPS/Camera work with permissions
- ✅ Data persists after app close
- ✅ Performance acceptable on 4G

**Estimated Time**: 2-4 hours for PWA, 2-3 days for native apps

---

Last updated: 2026-05-01
