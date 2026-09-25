import { History, LayoutDashboard, Search, Ticket, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router'
import { BackOfficeLayout, type BackOfficeNavItem } from '@/components/layout/back-office-layout'
import { useCustomerLogout } from '@/features/auth/queries'
import { useNotifications } from '@/features/notifications/queries'
import { ROLE_LABELS } from '@/lib/labels'
import { useSession } from '@/store/auth-store'

const NAV_ITEMS: BackOfficeNavItem[] = [
  { to: '/account', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/account/reservations', label: 'Mes réservations', icon: Ticket },
  { to: '/', label: 'Rechercher un trajet', icon: Search },
]

const MENU_ITEMS: BackOfficeNavItem[] = [
  { to: '/account/profile', label: 'Mon profil', icon: UserRound },
  { to: '/account', label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/account/reservations', label: 'Historique des réservations', icon: History },
]

/**
 * Espace client (/account) : tableau de bord du voyageur, accent bleu.
 */
export function CustomerLayout() {
  const session = useSession('customer')
  const navigate = useNavigate()
  const logout = useCustomerLogout()
  const notifications = useNotifications({}, !!session)

  if (!session) return null
  const { user } = session

  return (
    <BackOfficeLayout
      space="customer"
      spaceLabel="Espace voyageur"
      homePath="/account"
      profilePath="/account/profile"
      navItems={NAV_ITEMS}
      scopeLabel="Mon espace voyageur"
      user={{ name: user.name, email: user.email, roleLabel: ROLE_LABELS.customer, avatarUrl: user.avatar_url }}
      menuItems={MENU_ITEMS}
      notifications={{ unread: notifications.data?.unread_count ?? 0, to: '/account#notifications' }}
      onLogout={() => {
        // Retour à l'accueil d'abord : la garde de l'espace client redirigerait vers /login.
        navigate('/')
        logout.mutate()
      }}
    />
  )
}
