import { Building2 } from 'lucide-react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { BackOfficeLogin } from '@/components/layout/back-office-login'
import { useAgencyLogin } from '@/features/agency/session'
import { safeRedirect } from '@/lib/validation'
import { useSession } from '@/store/auth-store'

/**
 * Connexion du personnel (/agency/login), accessible directement sans passer
 * par l'espace public (§4.2). Seuls les rôles internes sont acceptés par l'API.
 */
export function AgencyLoginPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const session = useSession('agency')
  const login = useAgencyLogin()
  const redirect = safeRedirect(searchParams.get('redirect'), '/agency/dashboard')
  const target = redirect.startsWith('/agency') ? redirect : '/agency/dashboard'

  if (session) return <Navigate to={target} replace />

  return (
    <BackOfficeLogin
      title="Espace agence"
      description="Connexion réservée au personnel des agences."
      icon={Building2}
      login={login}
      onSuccess={() => navigate(target, { replace: true })}
    />
  )
}
