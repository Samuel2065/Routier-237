import { Building2, Landmark, LayoutDashboard, MapPinned, UsersRound } from 'lucide-react'
import { useNavigate } from 'react-router'
import { BackOfficeLayout, type BackOfficeNavItem } from '@/components/layout/back-office-layout'
import { useAdminLogout } from '@/features/admin/queries'
import { useSession } from '@/store/auth-store'

const NAV_ITEMS: BackOfficeNavItem[] = [
  { to: '/admin/dashboard', label: 'Supervision', icon: LayoutDashboard },
  { to: '/admin/organizations', label: 'Organisations', icon: Landmark },
  { to: '/admin/agencies', label: 'Agences', icon: Building2 },
  { to: '/admin/users', label: 'Utilisateurs', icon: UsersRound },
  { to: '/admin/referentials', label: 'Villes et itinéraires', icon: MapPinned },
]

/**
 * Espace administrateur de la plateforme (§13.3), distinct de l'espace agence (§4.3).
 */
export function AdminLayout() {
  const session = useSession('admin')
  const navigate = useNavigate()
  const logout = useAdminLogout()

  if (!session) return null

  return (
    <BackOfficeLayout
      spaceLabel="Administration"
      homePath="/admin/dashboard"
      navItems={NAV_ITEMS}
      scopeLabel="Plateforme Routier+237"
      userName={session.user.name}
      roleLabel="Administrateur plateforme"
      onLogout={() => logout.mutate(undefined, { onSettled: () => navigate('/admin/login', { replace: true }) })}
    />
  )
}
