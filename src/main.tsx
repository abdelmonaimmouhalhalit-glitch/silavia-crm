import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import './styles.css'

const container = document.getElementById('root')
if (!container) throw new Error('Élément #root introuvable dans index.html')

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    {/* `basename` suit le `base` Vite : indispensable pour un déploiement en sous-chemin
        (GitHub Pages, par exemple) sans casser les liens ni les routes protégées. */}
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
