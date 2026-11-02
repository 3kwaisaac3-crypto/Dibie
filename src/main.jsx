import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Service worker : sur le build seulement. En développement, un service worker
// resté d'une ancienne session servirait de vieux fichiers : il est retiré.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    navigator.serviceWorker.register('/service-worker.js').catch(e => console.log('SW registration failed:', e))
  } else {
    navigator.serviceWorker.getRegistrations().then(registrations => registrations.forEach(r => r.unregister()))
  }
}
