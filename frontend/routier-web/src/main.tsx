import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Après un déploiement, un onglet ouvert avant demande d'anciens fichiers (supprimés) :
// on recharge une fois pour prendre la nouvelle version. Une seule fois par minute (pas de boucle).
window.addEventListener('vite:preloadError', (event) => {
  const key = 'routier:reloaded-after-deploy'
  const last = Number(sessionStorage.getItem(key) ?? 0)
  if (Date.now() - last < 60_000) return
  event.preventDefault()
  sessionStorage.setItem(key, String(Date.now()))
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
