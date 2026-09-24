import { agencyApi, publicApi } from '@/api/client'
import type {
  AgencyDashboard,
  AgencyReservation,
  AuthPayload,
  Employee,
  EmployeeStatus,
  Envelope,
  ManagedAgency,
  ManagedTrip,
  Organization,
  Paginated,
  Payment,
  PaymentMethod,
  PaymentStatus,
  RecordStatus,
  ReservationStatus,
  RoleName,
  RouteRecord,
  TripStatus,
  User,
  Vehicle,
  VehicleStatus,
} from '@/types/api'

/**
 * Appels de l'espace agence (/agency/*). Le périmètre est toujours appliqué par l'API :
 * un identifiant d'une autre agence est refusé (403).
 */

type Params = Record<string, string | number | boolean | undefined>

/* Authentification ------------------------------------------------------- */

export async function loginAgency(payload: { email: string; password: string }): Promise<AuthPayload> {
  const { data } = await publicApi.post<Envelope<AuthPayload>>('/agency/auth/login', { ...payload, device_name: 'routier-web-agence' })
  return data.data
}

export async function fetchAgencyProfile(): Promise<User> {
  const { data } = await agencyApi.get<Envelope<User>>('/auth/me')
  return data.data
}

export async function logoutAgency(): Promise<void> {
  await agencyApi.post('/auth/logout')
}

/* Tableau de bord -------------------------------------------------------- */

export async function fetchDashboard(agencyId?: number): Promise<AgencyDashboard> {
  const { data } = await agencyApi.get<Envelope<AgencyDashboard>>('/agency/dashboard', { params: { agency_id: agencyId } })
  return data.data
}

/* Agences et organisation ------------------------------------------------ */

export interface AgencyInput {
  /** Espace administrateur uniquement (l'espace agence refuse ce champ). */
  organization_id?: number
  city_id?: number
  name?: string
  email?: string | null
  phone?: string | null
  address?: string | null
  description?: string | null
  status?: RecordStatus
}

export async function fetchManagedAgencies(params: Params = {}): Promise<Paginated<ManagedAgency>> {
  const { data } = await agencyApi.get<Paginated<ManagedAgency>>('/agency/agencies', { params: { per_page: 100, ...params } })
  return data
}

export async function createAgency(payload: AgencyInput): Promise<ManagedAgency> {
  const { data } = await agencyApi.post<Envelope<ManagedAgency>>('/agency/agencies', payload)
  return data.data
}

export async function updateAgency(id: number, payload: AgencyInput): Promise<ManagedAgency> {
  const { data } = await agencyApi.patch<Envelope<ManagedAgency>>(`/agency/agencies/${id}`, payload)
  return data.data
}

export async function updateAgencySettings(id: number, payload: Pick<AgencyInput, 'email' | 'phone' | 'address' | 'description'>): Promise<ManagedAgency> {
  const { data } = await agencyApi.patch<Envelope<ManagedAgency>>(`/agency/agencies/${id}/settings`, payload)
  return data.data
}

export async function fetchOrganization(id: number): Promise<Organization> {
  const { data } = await agencyApi.get<Envelope<Organization>>(`/agency/organizations/${id}`)
  return data.data
}

export async function updateOrganization(
  id: number,
  payload: { name?: string; email?: string | null; phone?: string | null; address?: string | null },
): Promise<Organization> {
  const { data } = await agencyApi.patch<Envelope<Organization>>(`/agency/organizations/${id}`, payload)
  return data.data
}

/* Itinéraires ------------------------------------------------------------ */

export async function fetchRoutes(params: Params = {}): Promise<Paginated<RouteRecord>> {
  const { data } = await agencyApi.get<Paginated<RouteRecord>>('/agency/routes', { params: { per_page: 100, status: 'active', ...params } })
  return data
}

export async function createRoute(payload: {
  departure_city_id: number
  destination_city_id: number
  estimated_duration_minutes?: number | null
  distance_km?: number | null
}): Promise<RouteRecord> {
  const { data } = await agencyApi.post<Envelope<RouteRecord>>('/agency/routes', payload)
  return data.data
}

/* Trajets ---------------------------------------------------------------- */

export interface TripFilters {
  agency_id?: number
  status?: TripStatus
  date_from?: string
  date_to?: string
  route_id?: number
  page?: number
}

export interface TripInput {
  agency_id?: number
  route_id: number
  vehicle_id: number
  departure_date: string
  departure_time: string
  price: number
  status?: 'draft' | 'published'
}

export async function fetchTrips(params: TripFilters = {}): Promise<Paginated<ManagedTrip>> {
  const { data } = await agencyApi.get<Paginated<ManagedTrip>>('/agency/trips', { params })
  return data
}

export async function createTrip(payload: TripInput): Promise<ManagedTrip> {
  const { data } = await agencyApi.post<Envelope<ManagedTrip>>('/agency/trips', payload)
  return data.data
}

export async function updateTrip(id: number, payload: Partial<Omit<TripInput, 'agency_id' | 'status'>>): Promise<ManagedTrip> {
  const { data } = await agencyApi.patch<Envelope<ManagedTrip>>(`/agency/trips/${id}`, payload)
  return data.data
}

export type TripAction = 'publish' | 'unpublish' | 'cancel' | 'complete'

export async function runTripAction(id: number, action: TripAction): Promise<ManagedTrip> {
  const { data } = await agencyApi.post<Envelope<ManagedTrip>>(`/agency/trips/${id}/${action}`)
  return data.data
}

export async function deleteTrip(id: number): Promise<void> {
  await agencyApi.delete(`/agency/trips/${id}`)
}

/* Véhicules -------------------------------------------------------------- */

export interface VehicleInput {
  agency_id?: number
  travel_class_id: number
  registration_number: string
  brand: string
  model: string
  capacity: number
  amenities: string[]
  status?: VehicleStatus
}

export async function fetchVehicles(params: Params = {}): Promise<Paginated<Vehicle>> {
  const { data } = await agencyApi.get<Paginated<Vehicle>>('/agency/vehicles', { params })
  return data
}

export async function createVehicle(payload: VehicleInput): Promise<Vehicle> {
  const { data } = await agencyApi.post<Envelope<Vehicle>>('/agency/vehicles', payload)
  return data.data
}

export async function updateVehicle(id: number, payload: Partial<Omit<VehicleInput, 'agency_id'>>): Promise<Vehicle> {
  const { data } = await agencyApi.patch<Envelope<Vehicle>>(`/agency/vehicles/${id}`, payload)
  return data.data
}

export async function deleteVehicle(id: number): Promise<void> {
  await agencyApi.delete(`/agency/vehicles/${id}`)
}

/* Personnel -------------------------------------------------------------- */

export interface EmployeeInput {
  agency_id?: number
  role?: RoleName
  name?: string
  email?: string
  phone?: string | null
  password?: string
  employee_number?: string
  hired_at?: string | null
  status?: EmployeeStatus
  license_number?: string
  license_expires_at?: string
}

export async function fetchEmployees(params: Params = {}): Promise<Paginated<Employee>> {
  const { data } = await agencyApi.get<Paginated<Employee>>('/agency/employees', { params })
  return data
}

export async function createEmployee(payload: EmployeeInput): Promise<Employee> {
  const { data } = await agencyApi.post<Envelope<Employee>>('/agency/employees', payload)
  return data.data
}

export async function updateEmployee(id: number, payload: EmployeeInput): Promise<Employee> {
  const { data } = await agencyApi.patch<Envelope<Employee>>(`/agency/employees/${id}`, payload)
  return data.data
}

/* Réservations ----------------------------------------------------------- */

export interface ReservationFilters {
  trip_id?: number
  status?: ReservationStatus
  date?: string
  search?: string
  page?: number
}

export async function fetchAgencyReservations(params: ReservationFilters = {}): Promise<Paginated<AgencyReservation>> {
  const { data } = await agencyApi.get<Paginated<AgencyReservation>>('/agency/reservations', { params })
  return data
}

export async function fetchAgencyReservation(id: number): Promise<AgencyReservation> {
  const { data } = await agencyApi.get<Envelope<AgencyReservation>>(`/agency/reservations/${id}`)
  return data.data
}

export async function cancelAgencyReservation(id: number): Promise<AgencyReservation> {
  const { data } = await agencyApi.post<Envelope<AgencyReservation>>(`/agency/reservations/${id}/cancel`)
  return data.data
}

/* Paiements -------------------------------------------------------------- */

export interface PaymentFilters {
  status?: PaymentStatus
  method?: PaymentMethod
  requires_refund?: boolean
  date_from?: string
  date_to?: string
  page?: number
}

export async function fetchAgencyPayments(params: PaymentFilters = {}): Promise<Paginated<Payment>> {
  const { data } = await agencyApi.get<Paginated<Payment>>('/agency/payments', {
    params: { ...params, requires_refund: params.requires_refund ? 1 : undefined },
  })
  return data
}

export async function refundPayment(id: number): Promise<Payment> {
  const { data } = await agencyApi.post<Envelope<Payment>>(`/agency/payments/${id}/refund`)
  return data.data
}
