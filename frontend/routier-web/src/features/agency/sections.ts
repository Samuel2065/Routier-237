import { Bus, CalendarClock, LayoutDashboard, Settings, Ticket, Users, Wallet, type LucideIcon } from 'lucide-react'

export interface AgencySection {
  path: string
  label: string
  icon: LucideIcon
  /** La section est accessible avec l'une de ces permissions. */
  permissions: string[]
}

/**
 * Sections de l'espace agence (§13.2) : source unique pour le menu et pour la garde
 * des routes. Une page non autorisée n'est ni proposée, ni chargée (l'API refuserait).
 */
export const AGENCY_SECTIONS: AgencySection[] = [
  { path: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, permissions: ['dashboard.view'] },
  { path: 'trips', label: 'Trajets', icon: CalendarClock, permissions: ['trips.view'] },
  { path: 'reservations', label: 'Réservations', icon: Ticket, permissions: ['reservations.view'] },
  { path: 'vehicles', label: 'Véhicules', icon: Bus, permissions: ['vehicles.view'] },
  { path: 'employees', label: 'Personnel', icon: Users, permissions: ['employees.view'] },
  { path: 'payments', label: 'Paiements', icon: Wallet, permissions: ['payments.view'] },
  { path: 'settings', label: 'Paramètres', icon: Settings, permissions: ['agency_settings.update', 'organizations.update'] },
]

export function sectionPermissions(path: string): string[] {
  return AGENCY_SECTIONS.find((section) => section.path === path)?.permissions ?? []
}
