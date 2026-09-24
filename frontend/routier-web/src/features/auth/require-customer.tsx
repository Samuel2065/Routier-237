import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from '@/store/auth-store'

/**
 * Garde des pages client : redirige vers /login en conservant la page demandée.
 * Confort d'affichage uniquement — l'API protège réellement les données.
 */
export function RequireCustomer() {
  const session = useSession('customer')
  const location = useLocation()

  if (!session) {
    const redirect = `${location.pathname}${location.search}`
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />
  }

  return <Outlet />
}
