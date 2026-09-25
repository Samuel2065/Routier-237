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
  /** Photo de profil (null : initiales affichées). */
  avatar_url: string | null
  status: 'active' | 'suspended'
  role: RoleName | null
  permissions: string[]
  /** Rôles que l'utilisateur peut attribuer au personnel (espace agence). */
  assignable_roles?: RoleName[]
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

/* ------------------------------------------------------------------ */
/* Espace agence                                                       */
/* ------------------------------------------------------------------ */

export type RecordStatus = 'active' | 'inactive'
export type TripStatus = 'draft' | 'published' | 'cancelled' | 'completed'
export type VehicleStatus = 'active' | 'maintenance' | 'retired'
export type EmployeeStatus = 'active' | 'suspended' | 'terminated'

export interface RouteRecord {
  id: number
  departure_city: City
  destination_city: City
  estimated_duration_minutes: number | null
  distance_km: number | null
  status: RecordStatus
}

export interface ManagedTrip {
  id: number
  agency: { id: number; name: string }
  route: RouteRecord
  vehicle: { id: number; registration_number: string; brand: string; model: string; status: VehicleStatus }
  travel_class: TravelClass
  departure_date: string
  departure_time: string
  departs_at: string
  arrives_at?: string
  price: number
  currency: 'XAF'
  status: TripStatus
  capacity: number
  reserved_seats: number
  remaining_seats: number
  created_at: string
}

export interface Vehicle {
  id: number
  agency?: { id: number; name: string }
  travel_class?: TravelClass
  registration_number: string
  brand: string
  model: string
  capacity: number
  amenities: string[]
  status: VehicleStatus
  upcoming_trips_count?: number
  created_at: string
}

export interface Employee {
  id: number
  user: { id: number; name: string; email: string; phone: string | null; status: 'active' | 'suspended' }
  role: RoleName | null
  agency: { id: number; name: string }
  employee_number: string
  hired_at: string | null
  status: EmployeeStatus
  driver_profile: {
    license_number: string
    license_expires_at: string
    license_expired: boolean
    status: RecordStatus
  } | null
  created_at: string
}

export interface ManagedAgency {
  id: number
  organization_id: number
  organization?: { id: number; name: string; status: RecordStatus }
  city?: City
  name: string
  email: string | null
  phone: string | null
  address: string | null
  description: string | null
  status: RecordStatus
  employees_count?: number
  vehicles_count?: number
}

export interface Organization {
  id: number
  name: string
  slug: string
  email: string | null
  phone: string | null
  address: string | null
  status: RecordStatus
  agencies_count?: number
  agencies?: ManagedAgency[]
  directors?: { id: number; name: string; email: string; phone: string | null; status: string }[]
  created_at?: string
  updated_at?: string
}

export interface AgencyReservation extends Reservation {
  customer?: { id: number; name: string; email: string; phone: string | null }
}

export interface AgencyDashboard {
  agency: { id: number; name: string } | null
  trips: { today: number; published_next_7_days: number; drafts: number }
  next_departures: {
    id: number
    agency: string
    departure_city: string
    destination_city: string
    departure_date: string
    departure_time: string
    travel_class: string
    capacity: number
    reserved_seats: number
  }[]
  reservations: { pending: number; confirmed_last_7_days: number; passengers_upcoming: number } | null
  payments: { paid_this_month_amount: number; paid_this_month_count: number; requires_refund: number } | null
  fleet: { active: number; maintenance: number } | null
}

/* ------------------------------------------------------------------ */
/* Espace administrateur                                               */
/* ------------------------------------------------------------------ */

export interface AdminUser {
  id: number
  name: string
  email: string
  phone: string | null
  status: 'active' | 'suspended'
  role: RoleName | null
  organization: { id: number; name: string } | null
  agency: { id: number; name: string } | null
  created_at: string
}

export interface AdminDashboard {
  organizations: { active: number; inactive: number }
  agencies: { active: number; inactive: number }
  users: { customers: number; staff: number; suspended: number }
  trips: { published_next_7_days: number }
  reservations: { confirmed_last_30_days: number; pending: number }
  payments: { paid_this_month_amount: number; requires_refund: number }
  /** Personnel dont un jeton a servi dans la fenêtre d'activité (window_minutes). */
  active_staff: {
    window_minutes: number
    count: number
    users: ActiveStaffMember[]
  }
}

export interface ActiveStaffMember {
  id: number
  name: string
  role: RoleName | null
  avatar_url: string | null
  agency: string | null
  organization: string | null
  last_active_at: string
}
