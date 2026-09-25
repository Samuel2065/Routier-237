import { screen, within } from '@testing-library/react'
import { vi } from 'vitest'
import { fetchAdminDashboard } from '@/api/admin'
import { AdminDashboardPage } from '@/pages/admin/dashboard-page'
import { renderWithProviders } from '@/test/render'
import type { AdminDashboard } from '@/types/api'

vi.mock('@/api/admin', () => ({ fetchAdminDashboard: vi.fn() }))

const base: Omit<AdminDashboard, 'active_staff'> = {
  organizations: { active: 1, inactive: 0 },
  agencies: { active: 2, inactive: 0 },
  users: { customers: 5, staff: 7, suspended: 0 },
  trips: { published_next_7_days: 12 },
  reservations: { confirmed_last_30_days: 3, pending: 1 },
  payments: { paid_this_month_amount: 45000, requires_refund: 0 },
}

describe('AdminDashboardPage', () => {
  it('lists the active staff with role, agency and last activity', async () => {
    vi.mocked(fetchAdminDashboard).mockResolvedValue({
      ...base,
      active_staff: {
        window_minutes: 15,
        count: 3,
        users: [
          {
            id: 4,
            name: 'Céline Mbarga',
            role: 'counter_clerk',
            avatar_url: null,
            agency: 'Agence Bertoua Centre',
            organization: 'Routier Démo Voyages',
            last_active_at: new Date(Date.now() - 5 * 60_000).toISOString(),
          },
          {
            id: 2,
            name: 'Paul Directeur',
            role: 'director',
            avatar_url: null,
            agency: null,
            organization: 'Routier Démo Voyages',
            last_active_at: new Date().toISOString(),
          },
        ],
      },
    })
    renderWithProviders(<AdminDashboardPage />)

    const list = await screen.findByRole('list', { name: 'Personnel actif' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Céline Mbarga')
    expect(items[0]).toHaveTextContent('Agent de guichet · Agence Bertoua Centre')
    expect(items[0]).toHaveTextContent('Actif il y a 5 min')
    expect(items[1]).toHaveTextContent('Directeur · Routier Démo Voyages')
    expect(items[1]).toHaveTextContent('Actif à l’instant')
    expect(screen.getByText('3 en ligne')).toBeInTheDocument()
    expect(screen.getByText('Et 1 autre(s) membre(s) du personnel actif(s).')).toBeInTheDocument()
  })

  it('shows an empty state when nobody is active', async () => {
    vi.mocked(fetchAdminDashboard).mockResolvedValue({ ...base, active_staff: { window_minutes: 15, count: 0, users: [] } })
    renderWithProviders(<AdminDashboardPage />)

    expect(await screen.findByText('Aucun membre du personnel actif dans les 15 dernières minutes.')).toBeInTheDocument()
  })
})
