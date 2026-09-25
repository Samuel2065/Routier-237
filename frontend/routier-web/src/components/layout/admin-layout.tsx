import { Building2, Landmark, LayoutDashboard, MapPinned, UserRound, UsersRound } from 'lucide-react'
import { useNavigate } from 'react-router'
import { BackOfficeLayout, type BackOfficeNavItem } from '@/components/layout/back-office-layout'
import { useAdminLogout } from '@/features/admin/queries'
import { ROLE_LABELS } from '@/lib/labels'
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
  const { user } = session

  return (
    <BackOfficeLayout
      space="admin"
      spaceLabel="Administration"
      homePath="/admin/dashboard"
      profilePath="/admin/profile"
      navItems={NAV_ITEMS}
      scopeLabel="Plateforme Routier+237"
      user={{ name: user.name, email: user.email, roleLabel: ROLE_LABELS.super_admin, avatarUrl: user.avatar_url }}
      menuItems={[
        { to: '/admin/profile', label: 'Mon profil', icon: UserRound },
        { to: '/admin/dashboard', label: 'Supervision', icon: LayoutDashboard },
      ]}
      onLogout={() => logout.mutate(undefined, { onSettled: () => navigate('/admin/login', { replace: true }) })}
      logoutPending={logout.isPending}
    />
  )
}
