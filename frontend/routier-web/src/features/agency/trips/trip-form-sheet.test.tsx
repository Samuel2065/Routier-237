import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { createTrip, fetchManagedAgencies, fetchRoutes, fetchVehicles } from '@/api/agency'
import { TripFormSheet } from '@/features/agency/trips/trip-form-sheet'
import { signInAgency } from '@/test/agency-session'
import { renderWithProviders } from '@/test/render'
import type { ManagedAgency, Paginated, RouteRecord, Vehicle } from '@/types/api'

vi.mock('@/api/agency', () => ({
  fetchManagedAgencies: vi.fn(),
  fetchRoutes: vi.fn(),
  fetchVehicles: vi.fn(),
  createTrip: vi.fn(),
  updateTrip: vi.fn(),
  createRoute: vi.fn(),
}))
vi.mock('@/api/catalog', () => ({ fetchCities: vi.fn(async () => []), fetchTravelClasses: vi.fn(async () => []) }))

const meta = { current_page: 1, last_page: 1, per_page: 100, total: 2 }
const city = (id: number, name: string) => ({ id, name, slug: name.toLowerCase() })

const agencies: ManagedAgency[] = [
  { id: 1, organization_id: 1, name: 'Agence Bertoua Centre', email: null, phone: null, address: null, description: null, status: 'active' },
  { id: 2, organization_id: 1, name: 'Agence Yaoundé Mvan', email: null, phone: null, address: null, description: null, status: 'active' },
]
const routes: RouteRecord[] = [
  { id: 3, departure_city: city(1, 'Bertoua'), destination_city: city(2, 'Yaoundé'), estimated_duration_minutes: 330, distance_km: 345, status: 'active' },
]
const vehicle = (id: number, agencyId: number, plate: string, className: string): Vehicle => ({
  id,
  agency: { id: agencyId, name: agencies[agencyId - 1].name },
  travel_class: { id: className === 'VIP' ? 1 : 2, code: className.toLowerCase(), name: className, description: null },
  registration_number: plate,
  brand: 'Toyota',
  model: 'Coaster',
  capacity: 30,
  amenities: [],
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
})

async function chooseOption(user: ReturnType<typeof userEvent.setup>, label: RegExp, option: RegExp) {
  await user.click(screen.getByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

describe('TripFormSheet — choix du véhicule', () => {
  beforeEach(() => {
    vi.mocked(fetchManagedAgencies).mockImplementation(async () => ({ data: agencies, meta }) as Paginated<ManagedAgency>)
    vi.mocked(fetchRoutes).mockImplementation(async () => ({ data: routes, meta }) as Paginated<RouteRecord>)
    vi.mocked(fetchVehicles).mockImplementation(async (params = {}) => ({
      data: [vehicle(10, 1, 'ES 214 AB', 'VIP'), vehicle(20, 2, 'CE 108 GH', 'VIP')].filter((item) => !params.agency_id || item.agency?.id === params.agency_id),
      meta,
    }))
    vi.mocked(createTrip).mockReset()
    vi.mocked(createTrip).mockImplementation(async () => ({}) as never)
  })

  it("lets a director pick an agency, then one of that agency's vehicles", async () => {
    const user = userEvent.setup()
    signInAgency('director', ['trips.create', 'trips.publish', 'routes.manage', 'agencies.view'], { agency: null })
    renderWithProviders(<TripFormSheet open onOpenChange={vi.fn()} />)

    await chooseOption(user, /Agence/, /Agence Yaoundé Mvan/)
    await chooseOption(user, /Itinéraire/, /Bertoua → Yaoundé/)
    await chooseOption(user, /Véhicule/, /CE 108 GH/)

    expect(screen.getByText(/Classe du trajet/)).toHaveTextContent('VIP')

    await user.type(screen.getByLabelText(/Prix par passager/), '7000')
    await user.click(screen.getByRole('button', { name: 'Créer le trajet' }))

    await waitFor(() => expect(createTrip).toHaveBeenCalledWith(expect.objectContaining({ agency_id: 2, vehicle_id: 20, route_id: 3, price: 7000 })))
  })

  it('explains how to proceed when the chosen agency has no vehicle in service', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchVehicles).mockImplementation(async () => ({ data: [], meta: { ...meta, total: 0 } }))
    signInAgency('director', ['trips.create', 'vehicles.create', 'agencies.view'], { agency: null })
    renderWithProviders(<TripFormSheet open onOpenChange={vi.fn()} />)

    expect(screen.getByRole('combobox', { name: /Véhicule/ })).toBeDisabled()
    await chooseOption(user, /Agence/, /Agence Yaoundé Mvan/)

    expect(await screen.findByText('Aucun véhicule en service dans cette agence')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Véhicule/ })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Ajouter un véhicule' })).toHaveAttribute('href', '/agency/vehicles?new=1&agency_id=2')
  })

  it('tells a manager without vehicles who can add one', async () => {
    vi.mocked(fetchVehicles).mockImplementation(async () => ({ data: [], meta: { ...meta, total: 0 } }))
    signInAgency('counter_clerk', ['trips.create'])
    renderWithProviders(<TripFormSheet open onOpenChange={vi.fn()} />)

    expect(await screen.findByText('Aucun véhicule en service dans cette agence')).toBeInTheDocument()
    expect(screen.getByText(/Demandez au responsable de l'agence/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ajouter un véhicule' })).not.toBeInTheDocument()
  })

  it('lets an agency manager pick a vehicle of their agency directly', async () => {
    const user = userEvent.setup()
    signInAgency('agency_manager', ['trips.create', 'trips.publish', 'routes.manage', 'agencies.view'])
    renderWithProviders(<TripFormSheet open onOpenChange={vi.fn()} />)

    await chooseOption(user, /Itinéraire/, /Bertoua → Yaoundé/)
    await chooseOption(user, /Véhicule/, /ES 214 AB/)
    await user.type(screen.getByLabelText(/Prix par passager/), '5000')
    await user.click(screen.getByRole('button', { name: 'Créer le trajet' }))

    await waitFor(() => expect(createTrip).toHaveBeenCalledWith(expect.objectContaining({ vehicle_id: 10, route_id: 3, price: 5000 })))
    expect(vi.mocked(createTrip).mock.calls[0][0]).not.toHaveProperty('agency_id', expect.anything())
  })
})
