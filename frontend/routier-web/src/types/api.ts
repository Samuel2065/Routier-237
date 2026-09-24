/**
 * Types des réponses de l'API Laravel (API Resources, préfixe /api/v1).
 */

export type Space = 'customer' | 'agency' | 'admin'

export type RoleName =
  | 'super_admin'
  | 'director'
  | 'agency_manager'
  | 'counter_clerk'
  | 'accountant'
  | 'driver'
  | 'customer'

export interface City {
  id: number
  name: string
  slug: string
}

export interface TravelClass {
  id: number
  code: string
  name: string
  description: string | null
}

export interface User {
  id: number
  name: string
  email: string
  phone: string | null
  status: 'active' | 'suspended'
  role: RoleName | null
  permissions: string[]
  organization: { id: number; name: string } | null
  agency: { id: number; name: string } | null
  created_at: string
}

export interface AuthPayload {
  token: string
  token_type: 'Bearer'
  expires_at: string | null
  space: Space
  user: User
}

export interface PublicAgency {
  id: number
  name: string
  organization?: { id: number; name: string }
  city?: City
  email: string | null
  phone: string | null
  address: string | null
  description: string | null
}

export interface PublicTrip {
  id: number
  agency: { id: number; name: string; city: City }
  departure_city: City
  destination_city: City
  departure_date: string
  departure_time: string
  departs_at: string
  estimated_arrival_at: string | null
  estimated_duration_minutes: number | null
  distance_km: number | null
  travel_class: TravelClass
  price: number
  currency: 'XAF'
  remaining_seats: number
  /** Présents sur la page de détail uniquement. */
  vehicle?: { brand: string; model: string; capacity: number; amenities: string[] }
  bookable?: boolean
}

export interface SearchMeta {
  departure_city: City
  destination_city: City
  date: string
  passengers: number
  count: number
}

export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'expired'

export type PassengerType = 'adult' | 'child'

export interface Passenger {
  id: number
  full_name: string
  phone: string | null
  birth_date: string | null
  passenger_type: PassengerType
}

export type PaymentMethod = 'orange_money' | 'mtn_momo' | 'card'

export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'refunded'

export interface Payment {
  id: number
  reservation_id: number
  reservation?: { id: number; reference: string; status: ReservationStatus; trip_id: number }
  amount: number
  currency: string
  method: PaymentMethod
  provider: string | null
  status: PaymentStatus
  transaction_reference: string | null
  payer_phone: string | null
  paid_at: string | null
  failure_reason: string | null
  requires_refund?: boolean
  created_at: string
}

export interface ReservationTrip {
  id: number
  agency: { id: number; name: string; phone: string | null }
  departure_city: City
  destination_city: City
  departure_date: string
  departure_time: string
  departs_at: string
  travel_class: TravelClass
  unit_price: number
  status: 'draft' | 'published' | 'cancelled' | 'completed'
}

export interface Reservation {
  id: number
  reference: string
  status: ReservationStatus
  passenger_count: number
  total_amount: number
  currency: 'XAF'
  expires_at: string | null
  confirmed_at: string | null
  cancelled_at: string | null
  created_at: string
  trip?: ReservationTrip
  passengers?: Passenger[]
  payments?: Payment[]
}

export interface PaginationMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface Paginated<T> {
  data: T[]
  meta: PaginationMeta
}

export interface AppNotification {
  id: string
  type: 'reservation_confirmed' | 'reservation_cancelled' | 'payment_failed' | null
  data: { message: string; reference?: string; reservation_id?: number }
  read_at: string | null
  created_at: string
}

export interface NotificationPage {
  data: AppNotification[]
  current_page: number
  last_page: number
  total: number
  unread_count: number
}

/** Enveloppe { data: ... } des API Resources Laravel. */
export interface Envelope<T> {
  data: T
}
