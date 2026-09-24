import { customerApi } from '@/api/client'
import type { Envelope, Paginated, PassengerType, Reservation, ReservationStatus } from '@/types/api'

export interface PassengerInput {
  full_name: string
  phone?: string | null
  birth_date?: string | null
  passenger_type: PassengerType
}

export interface CreateReservationPayload {
  trip_id: number
  passengers: PassengerInput[]
}

export async function createReservation(payload: CreateReservationPayload): Promise<Reservation> {
  const { data } = await customerApi.post<Envelope<Reservation>>('/account/reservations', payload)
  return data.data
}

export async function fetchMyReservations(params: { status?: ReservationStatus; page?: number } = {}): Promise<Paginated<Reservation>> {
  const { data } = await customerApi.get<Paginated<Reservation>>('/account/reservations', { params })
  return data
}

export async function fetchMyReservation(id: number): Promise<Reservation> {
  const { data } = await customerApi.get<Envelope<Reservation>>(`/account/reservations/${id}`)
  return data.data
}

export async function cancelMyReservation(id: number): Promise<Reservation> {
  const { data } = await customerApi.post<Envelope<Reservation>>(`/account/reservations/${id}/cancel`)
  return data.data
}
