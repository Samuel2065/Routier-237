import { LayoutDashboard, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router'
import { BackOfficeLayout } from '@/components/layout/back-office-layout'
import { AGENCY_SECTIONS } from '@/features/agency/sections'
import { useAgencyLogout, useAgencyProfileRefresh, useCan } from '@/features/agency/session'
import { ROLE_LABELS } from '@/lib/labels'
import { useSession } from '@/store/auth-store'

/**
 * Espace agence : menu limité aux sections autorisées par les permissions.
 */
export function AgencyLayout() {
  const session = useSession('agency')
  const navigate = useNavigate()
  const logout = useAgencyLogout()
  const can = useCan()
  useAgencyProfileRefresh()

  if (!session) return null
  const { user } = session

  return (
    <BackOfficeLayout
      space="agency"
      spaceLabel="Espace agence"
      homePath="/agency/dashboard"
      profilePath="/agency/profile"
      navItems={AGENCY_SECTIONS.filter((section) => section.permissions.some(can)).map(({ path, label, icon }) => ({
        to: `/agency/${path}`,
        label,
        icon,
      }))}
      scopeLabel={user.agency?.name ?? user.organization?.name ?? ''}
      user={{ name: user.name, email: user.email, roleLabel: user.role ? ROLE_LABELS[user.role] : '', avatarUrl: user.avatar_url }}
      menuItems={[
        { to: '/agency/profile', label: 'Mon profil', icon: UserRound },
        ...(can('dashboard.view') ? [{ to: '/agency/dashboard', label: 'Tableau de bord', icon: LayoutDashboard }] : []),
      ]}
      onLogout={() => logout.mutate(undefined, { onSettled: () => navigate('/agency/login', { replace: true }) })}
      logoutPending={logout.isPending}
    />
  )
}
