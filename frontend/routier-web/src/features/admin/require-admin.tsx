import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from '@/store/auth-store'

/**
 * Garde de l'espace administrateur (l'API n'accepte de toute façon que les jetons « admin »).
 */
export function RequireAdmin() {
  const session = useSession('admin')
  const location = useLocation()

  if (!session) {
    return <Navigate to={`/admin/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />
  }

  return <Outlet />
}
