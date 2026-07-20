import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/field-tracker/',
  plugins: [
    react(),
    VitePWA({
      // A new version installs quietly in the background and only takes effect the
      // next time the app is fully closed and reopened. This is critical for field
      // use: 'autoUpdate' would reload the page mid-entry when a new version ships,
      // wiping in-progress data. 'prompt' keeps the running session untouched.
      registerType: 'prompt',
      // The service worker registration script is injected automatically.
      injectRegister: 'auto',
      // Keep the existing, hand-tuned public/manifest.json (share_target, shortcuts, etc.)
      // and its <link> in index.html — do NOT let the plugin generate a manifest.
      manifest: false,
      // Static files (not part of the JS build graph) that must also be cached for offline.
      includeAssets: [
        'favicon.svg',
        'icon-192.png',
        'icon-512.png',
        'icon-maskable-192.png',
        'icon-maskable-512.png',
        'apple-touch-icon.png',
        'manifest.json',
      ],
      workbox: {
        // Precache EVERY built asset, including the lazy-loaded geotiff codec chunks
        // (deflate, jpeg, lzw, zstd, lerc, …) and the web worker — so the full app,
        // including raster analysis, works offline on the first launch.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,wasm,woff2}'],
        // The main bundle is ~1.7 MB; raise the limit so it is always precached.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // SPA offline fallback: any in-app navigation resolves to the cached shell.
        navigateFallback: '/field-tracker/index.html',
        // Drop caches from superseded service workers.
        cleanupOutdatedCaches: true,
        // Do NOT take over or reload active tabs — let the new worker wait until the
        // app is next launched, so a deploy never disrupts an in-progress entry.
        clientsClaim: false,
        skipWaiting: false,
      },
    }),
  ],
})
