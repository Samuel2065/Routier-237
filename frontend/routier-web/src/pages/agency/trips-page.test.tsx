import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { fetchTrips, runTripAction } from '@/api/agency'
import { AgencyTripsPage } from '@/pages/agency/trips-page'
import { signInAgency } from '@/test/agency-session'
import { renderWithProviders } from '@/test/render'
import type { ManagedTrip, Paginated } from '@/types/api'

vi.mock('@/api/agency', () => ({
  fetchTrips: vi.fn(),
  runTripAction: vi.fn(),
  deleteTrip: vi.fn(),
  fetchManagedAgencies: vi.fn(),
  fetchRoutes: vi.fn(),
  fetchVehicles: vi.fn(),
}))

const city = (id: number, name: string) => ({ id, name, slug: name.toLowerCase() })

const trip: ManagedTrip = {
  id: 12,
  agency: { id: 1, name: 'Agence Bertoua Centre' },
  route: {
    id: 3,
    departure_city: city(1, 'Bertoua'),
    destination_city: city(2, 'Yaoundé'),
    estimated_duration_minutes: 330,
    distance_km: 345,
    status: 'active',
  },
  vehicle: { id: 5, registration_number: 'ES 214 AB', brand: 'Toyota', model: 'Coaster', status: 'active' },
  travel_class: { id: 1, code: 'vip', name: 'VIP', description: null },
  departure_date: '2030-01-10',
  departure_time: '06:00',
  departs_at: '2030-01-10T06:00:00+01:00',
  price: 7000,
  currency: 'XAF',
  status: 'published',
  capacity: 30,
  reserved_seats: 4,
  remaining_seats: 26,
  created_at: '2026-01-01T00:00:00Z',
}

const page: Paginated<ManagedTrip> = { data: [trip], meta: { current_page: 1, last_page: 1, per_page: 25, total: 1 } }

const MANAGER_PERMISSIONS = ['dashboard.view', 'trips.view', 'trips.create', 'trips.update', 'trips.publish', 'trips.cancel', 'reservations.view']

describe('AgencyTripsPage', () => {
  beforeEach(() => {
    vi.mocked(fetchTrips).mockReset()
    vi.mocked(runTripAction).mockReset()
    vi.mocked(fetchTrips).mockImplementation(async () => page)
  })

  it('lets a manager cancel a trip after confirmation', async () => {
    const user = userEvent.setup()
    signInAgency('agency_manager', MANAGER_PERMISSIONS)
    vi.mocked(runTripAction).mockImplementation(async () => ({ ...trip, status: 'cancelled' }))

    renderWithProviders(<AgencyTripsPage />, { route: '/agency/trips' })

    expect(await screen.findByText('Bertoua → Yaoundé')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nouveau trajet' })).toBeInTheDocument()
    expect(screen.getByText('4/30')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Actions pour le trajet/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Annuler le trajet' }))

    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/4 place\(s\) réservée\(s\) seront annulées/)).toBeInTheDocument()
    expect(runTripAction).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Annuler le trajet' }))
    await waitFor(() => expect(runTripAction).toHaveBeenCalledWith(12, 'cancel'))
  })

  it('hides management actions from a driver', async () => {
    const user = userEvent.setup()
    signInAgency('driver', ['dashboard.view', 'trips.view', 'vehicles.view'])

    renderWithProviders(<AgencyTripsPage />, { route: '/agency/trips' })

    expect(await screen.findByText('Bertoua → Yaoundé')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nouveau trajet' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Actions pour le trajet/ }))
    expect(screen.queryByRole('menuitem', { name: 'Annuler le trajet' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Modifier' })).not.toBeInTheDocument()
  })
})
