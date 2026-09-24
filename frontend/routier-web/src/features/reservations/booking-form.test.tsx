import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'
import { vi } from 'vitest'
import { createReservation } from '@/api/reservations'
import { BookingForm } from '@/features/reservations/booking-form'
import { renderWithProviders } from '@/test/render'
import type { PublicTrip, Reservation, User } from '@/types/api'

vi.mock('@/api/reservations', () => ({ createReservation: vi.fn() }))

const trip: PublicTrip = {
  id: 7,
  agency: { id: 1, name: 'Agence Bertoua Centre', city: { id: 3, name: 'Bertoua', slug: 'bertoua' } },
  departure_city: { id: 3, name: 'Bertoua', slug: 'bertoua' },
  destination_city: { id: 1, name: 'Yaoundé', slug: 'yaounde' },
  departure_date: '2030-01-10',
  departure_time: '06:00',
  departs_at: '2030-01-10T06:00:00+01:00',
  estimated_arrival_at: null,
  estimated_duration_minutes: 330,
  distance_km: 345,
  travel_class: { id: 1, code: 'vip', name: 'VIP', description: null },
  price: 7000,
  currency: 'XAF',
  remaining_seats: 3,
  bookable: true,
}

const customer: User = {
  id: 9,
  name: 'Client Démo',
  email: 'client@routier237.test',
  phone: '699000000',
  status: 'active',
  role: 'customer',
  permissions: [],
  organization: null,
  agency: null,
  created_at: '2026-09-24T00:00:00Z',
}

const plain = (value: string | null) => (value ?? '').replace(/[\u00a0\u202f]/g, ' ')

describe('BookingForm', () => {
  // Corps en bloc : une fonction retournée par beforeEach serait exécutée comme nettoyage.
  beforeEach(() => {
    vi.mocked(createReservation).mockReset()
  })

  it('books several passengers, including a child, with the customer prefilled', async () => {
    const user = userEvent.setup()
    const onBooked = vi.fn()
    vi.mocked(createReservation).mockResolvedValue({ id: 42, reference: 'R237-ABCDEFGH' } as Reservation)

    renderWithProviders(<BookingForm trip={trip} customer={customer} onBooked={onBooked} />)

    expect(screen.getByLabelText(/Nom complet/, { selector: '#passengers-0-full_name' })).toHaveValue('Client Démo')

    await user.click(screen.getByRole('button', { name: 'Ajouter un enfant' }))
    await user.type(screen.getByLabelText(/Nom complet/, { selector: '#passengers-1-full_name' }), 'Petit Démo')

    expect(plain(screen.getByText(/^Total/).textContent)).toBe('Total : 14 000 FCFA')

    await user.click(screen.getByRole('button', { name: 'Réserver et passer au paiement' }))

    await waitFor(() => expect(onBooked).toHaveBeenCalled())
    expect(createReservation).toHaveBeenCalledWith({
      trip_id: 7,
      passengers: [
        { full_name: 'Client Démo', passenger_type: 'adult', phone: '699000000', birth_date: null },
        { full_name: 'Petit Démo', passenger_type: 'child', phone: null, birth_date: null },
      ],
    })
  })

  it('does not allow more passengers than the remaining seats', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BookingForm trip={trip} customer={customer} onBooked={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Ajouter un adulte' }))
    await user.click(screen.getByRole('button', { name: 'Ajouter un adulte' }))

    expect(screen.getByRole('button', { name: 'Ajouter un adulte' })).toBeDisabled()
    expect(screen.getByText(/3 passager\(s\) au maximum/)).toBeInTheDocument()
  })

  it('validates passenger names before calling the API', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BookingForm trip={trip} customer={{ ...customer, name: '' }} onBooked={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Réserver et passer au paiement' }))

    expect(await screen.findByText('Indiquez le nom complet du passager.')).toBeInTheDocument()
    expect(createReservation).not.toHaveBeenCalled()
  })

  it('shows the API refusal when seats are no longer available', async () => {
    const user = userEvent.setup()
    const config = { headers: new AxiosHeaders() }
    const conflict = new AxiosError('Conflict', 'ERR_BAD_REQUEST', config, null, {
      status: 409,
      statusText: 'Conflict',
      headers: {},
      config,
      data: { message: 'Places insuffisantes : il reste 0 place(s) sur ce trajet.' },
    })
    vi.mocked(createReservation).mockImplementation(async () => {
      throw conflict
    })

    renderWithProviders(<BookingForm trip={trip} customer={customer} onBooked={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Réserver et passer au paiement' }))

    expect(await screen.findByText('Places insuffisantes : il reste 0 place(s) sur ce trajet.')).toBeInTheDocument()
  })
})
