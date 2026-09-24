import { ShieldCheck } from 'lucide-react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { BackOfficeLogin } from '@/components/layout/back-office-login'
import { useAdminLogin } from '@/features/admin/queries'
import { safeRedirect } from '@/lib/validation'
import { useSession } from '@/store/auth-store'

/**
 * Connexion de l'administrateur de la plateforme (/admin/login).
 */
export function AdminLoginPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const session = useSession('admin')
  const login = useAdminLogin()
  const redirect = safeRedirect(searchParams.get('redirect'), '/admin/dashboard')
  const target = redirect.startsWith('/admin') ? redirect : '/admin/dashboard'

  if (session) return <Navigate to={target} replace />

  return (
    <BackOfficeLogin
      title="Administration"
      description="Accès réservé à l'administration de la plateforme."
      icon={ShieldCheck}
      login={login}
      onSuccess={() => navigate(target, { replace: true })}
    />
  )
}
