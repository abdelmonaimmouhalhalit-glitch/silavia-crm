import { Navigate, Route, Routes } from 'react-router-dom'
import RequireAuth from './auth/RequireAuth'
import Dashboard from './pages/Dashboard'
import Forgot from './pages/Forgot'
import Login from './pages/Login'
import Reset from './pages/Reset'
import Signup from './pages/Signup'
import { supabaseConfigError } from './lib/supabase'

function ConfigErrorScreen({ message }: { message: string }) {
  return (
    <div className="auth-page">
      <main className="auth-card card">
        <p className="auth-brand">Silavia</p>
        <h1 className="auth-title">Configuration requise</h1>
        <p className="alert alert-error" role="alert">
          {message}
        </p>
        <pre className="code-block">{`VITE_SUPABASE_URL=https://xxxxx.supabase.co\nVITE_SUPABASE_ANON_KEY=eyJhbGciOi…`}</pre>
        <p className="muted">
          Créez le fichier <code>.env.local</code> à la racine du projet, collez vos clés puis redémarrez
          <code> npm run dev</code>.
        </p>
      </main>
    </div>
  )
}

export default function App() {
  if (supabaseConfigError) {
    return <ConfigErrorScreen message={supabaseConfigError} />
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/tableau" replace />} />
      <Route path="/connexion" element={<Login />} />
      <Route path="/inscription" element={<Signup />} />
      <Route path="/mot-de-passe-oublie" element={<Forgot />} />
      <Route path="/reinitialiser-mot-de-passe" element={<Reset />} />
      <Route
        path="/tableau"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/tableau" replace />} />
    </Routes>
  )
}
