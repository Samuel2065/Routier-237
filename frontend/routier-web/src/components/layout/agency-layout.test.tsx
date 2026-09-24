import { screen, within } from '@testing-library/react'
import { vi } from 'vitest'
import { AgencyLayout } from '@/components/layout/agency-layout'
import { signInAgency } from '@/test/agency-session'
import { renderWithProviders } from '@/test/render'

vi.mock('@/api/agency', () => ({
  fetchAgencyProfile: vi.fn(() => new Promise(() => {})),
  logoutAgency: vi.fn(),
}))

function navLabels() {
  const nav = screen.getByRole('navigation', { name: "Navigation de l'espace agence" })
  return within(nav)
    .getAllByRole('link')
    .map((link) => link.textContent)
}

describe('AgencyLayout', () => {
  it('shows only the sections allowed to a driver', () => {
    signInAgency('driver', ['dashboard.view', 'trips.view', 'vehicles.view'])
    renderWithProviders(<AgencyLayout />, { route: '/agency/dashboard' })

    expect(navLabels()).toEqual(['Tableau de bord', 'Trajets', 'Véhicules'])
    expect(screen.getByText('Agence Bertoua Centre')).toBeInTheDocument()
  })

  it('shows the management sections to an agency manager', () => {
    signInAgency('agency_manager', [
      'dashboard.view',
      'trips.view',
      'reservations.view',
      'vehicles.view',
      'employees.view',
      'payments.view',
      'agency_settings.update',
    ])
    renderWithProviders(<AgencyLayout />, { route: '/agency/dashboard' })

    expect(navLabels()).toEqual(['Tableau de bord', 'Trajets', 'Réservations', 'Véhicules', 'Personnel', 'Paiements', 'Paramètres'])
  })
})
