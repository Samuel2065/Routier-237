import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from '@/store/auth-store'

/**
 * Garde de l'espace agence : redirige vers /agency/login (confort d'affichage,
 * l'API refuse de toute façon un jeton absent ou d'un autre espace).
 */
export function RequireAgency() {
  const session = useSession('agency')
  const location = useLocation()

  if (!session) {
    return <Navigate to={`/agency/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />
  }

  return <Outlet />
}
