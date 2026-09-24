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
      spaceLabel="Espace agence"
      homePath="/agency/dashboard"
      navItems={AGENCY_SECTIONS.filter((section) => section.permissions.some(can)).map(({ path, label, icon }) => ({
        to: `/agency/${path}`,
        label,
        icon,
      }))}
      scopeLabel={user.agency?.name ?? user.organization?.name ?? ''}
      userName={user.name}
      roleLabel={user.role ? ROLE_LABELS[user.role] : ''}
      onLogout={() => logout.mutate(undefined, { onSettled: () => navigate('/agency/login', { replace: true }) })}
    />
  )
}
