import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { NotificationProvider } from './context/NotificationContext'

// One-time cleanup of legacy Cache Storage created by the previous hand-written
// service worker (named "field-tracker-v*"). The current service worker is generated
// by vite-plugin-pwa/Workbox, which manages its own "workbox-*" caches, so the old
// caches are unused and can be safely removed.
if ('caches' in window) {
  caches.keys().then((keys) => {
    keys
      .filter((key) => key.startsWith('field-tracker-'))
      .forEach((key) => caches.delete(key))
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <NotificationProvider>
      <App />
    </NotificationProvider>
  </StrictMode>,
)
