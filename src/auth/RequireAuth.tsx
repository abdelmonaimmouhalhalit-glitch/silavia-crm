import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'

/** Écran de chargement affiché pendant la vérification de la session. */
export function LoadingScreen({ message = 'Vérification de votre session…' }: { message?: string }) {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>{message}</p>
    </div>
  )
}

type RequireAuthProps = {
  children?: ReactNode
}

/**
 * Protège les routes privées :
 * - affiche un écran de chargement tant que la session n'est pas vérifiée ;
 * - redirige vers /connexion (en mémorisant la page demandée) si l'utilisateur
 *   n'est pas connecté.
 */
export default function RequireAuth({ children }: RequireAuthProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <LoadingScreen message="Chargement de votre espace…" />
  }

  if (!user) {
    return <Navigate to="/connexion" replace state={{ from: location.pathname }} />
  }

  return <>{children ?? <Outlet />}</>
}
