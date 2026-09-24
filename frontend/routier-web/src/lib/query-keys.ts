import type { TripSearchParams } from '@/api/trips'
import type { ReservationStatus } from '@/types/api'

/**
 * Clés TanStack Query centralisées (invalidation cohérente après une action).
 */
export const queryKeys = {
  cities: ['cities'] as const,
  travelClasses: ['travel-classes'] as const,
  agencies: (params: object = {}) => ['agencies', params] as const,
  agency: (id: number) => ['agency', id] as const,
  agencyTrips: (id: number) => ['agency', id, 'trips'] as const,
  tripSearch: (params: TripSearchParams) => ['trips', 'search', params] as const,
  trip: (id: number) => ['trip', id] as const,
  me: ['account', 'me'] as const,
  myReservations: (params: { status?: ReservationStatus; page?: number } = {}) => ['account', 'reservations', params] as const,
  myReservationsAll: ['account', 'reservations'] as const,
  myReservation: (id: number) => ['account', 'reservation', id] as const,
  payment: (id: number) => ['account', 'payment', id] as const,
  notifications: (params: object = {}) => ['account', 'notifications', params] as const,
  notificationsAll: ['account', 'notifications'] as const,
}
