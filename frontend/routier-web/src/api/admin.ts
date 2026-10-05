import { adminApi, publicApi } from '@/api/client'
import type {
  AdminDashboard,
  AdminPayment,
  AdminReservation,
  AdminTrip,
  AdminUser,
  AuditLogEntry,
  AuthPayload,
  City,
  Envelope,
  ManagedAgency,
  Organization,
  Paginated,
  RecordStatus,
  RoleName,
  RouteRecord,
  User,
} from '@/types/api'

/**
 * Appels de l'espace administrateur de la plateforme (/admin/*), réservés au super_admin.
 */

type Params = Record<string, string | number | undefined>

/* Authentification ------------------------------------------------------- */

export async function loginAdmin(payload: { email: string; password: string }): Promise<AuthPayload> {
  const { data } = await publicApi.post<Envelope<AuthPayload>>('/admin/auth/login', { ...payload, device_name: 'routier-web-admin' })
  return data.data
}

export async function fetchAdminProfile(): Promise<User> {
  const { data } = await adminApi.get<Envelope<User>>('/auth/me')
  return data.data
}

export async function logoutAdmin(): Promise<void> {
  await adminApi.post('/auth/logout')
}

/* Supervision ------------------------------------------------------------ */

export async function fetchAdminDashboard(): Promise<AdminDashboard> {
  const { data } = await adminApi.get<Envelope<AdminDashboard>>('/admin/dashboard')
  return data.data
}

/* Organisations et directors --------------------------------------------- */

export interface OrganizationInput {
  name?: string
  email?: string | null
  phone?: string | null
  address?: string | null
  status?: RecordStatus
}

export async function fetchOrganizations(params: Params = {}): Promise<Paginated<Organization>> {
  const { data } = await adminApi.get<Paginated<Organization>>('/admin/organizations', { params })
  return data
}

export async function fetchAdminOrganization(id: number): Promise<Organization> {
  const { data } = await adminApi.get<Envelope<Organization>>(`/admin/organizations/${id}`)
  return data.data
}

export async function createOrganization(payload: OrganizationInput): Promise<Organization> {
  const { data } = await adminApi.post<Envelope<Organization>>('/admin/organizations', payload)
  return data.data
}

export async function updateAdminOrganization(id: number, payload: OrganizationInput): Promise<Organization> {
  const { data } = await adminApi.patch<Envelope<Organization>>(`/admin/organizations/${id}`, payload)
  return data.data
}

export async function createDirector(
  organizationId: number,
  payload: { name: string; email: string; phone?: string | null; password: string },
): Promise<User> {
  const { data } = await adminApi.post<Envelope<User>>(`/admin/organizations/${organizationId}/directors`, payload)
  return data.data
}

/* Agences ---------------------------------------------------------------- */

export interface AdminAgencyInput {
  organization_id?: number
  city_id?: number
  name?: string
  email?: string | null
  phone?: string | null
  address?: string | null
  description?: string | null
  status?: RecordStatus
}

export async function fetchAdminAgencies(params: Params = {}): Promise<Paginated<ManagedAgency>> {
  const { data } = await adminApi.get<Paginated<ManagedAgency>>('/admin/agencies', { params })
  return data
}

export async function createAdminAgency(payload: AdminAgencyInput): Promise<ManagedAgency> {
  const { data } = await adminApi.post<Envelope<ManagedAgency>>('/admin/agencies', payload)
  return data.data
}

export async function updateAdminAgency(id: number, payload: AdminAgencyInput): Promise<ManagedAgency> {
  const { data } = await adminApi.patch<Envelope<ManagedAgency>>(`/admin/agencies/${id}`, payload)
  return data.data
}

/* Utilisateurs ----------------------------------------------------------- */

export async function fetchAdminUsers(params: { role?: RoleName; status?: string; search?: string; organization_id?: number; page?: number } = {}): Promise<Paginated<AdminUser>> {
  const { data } = await adminApi.get<Paginated<AdminUser>>('/admin/users', { params })
  return data
}

export async function updateAdminUserStatus(id: number, status: 'active' | 'suspended'): Promise<AdminUser> {
  const { data } = await adminApi.patch<Envelope<AdminUser>>(`/admin/users/${id}`, { status })
  return data.data
}

/** Détail d'un compte : rôle et permissions (lecture seule), sessions et activité. */
export async function fetchAdminUser(id: number): Promise<AdminUser> {
  const { data } = await adminApi.get<Envelope<AdminUser>>(`/admin/users/${id}`)
  return data.data
}

/**
 * Envoie à la personne un lien de réinitialisation (60 min, usage unique). L'administrateur
 * ne voit ni ne choisit jamais le mot de passe.
 */
export async function sendPasswordResetLink(id: number): Promise<string> {
  const { data } = await adminApi.post<{ message: string }>(`/admin/users/${id}/password-reset`)
  return data.message
}

/* Supervision de l'activité (lecture seule) et journal d'audit --------------- */

export async function fetchAdminTrips(params: Params = {}): Promise<Paginated<AdminTrip>> {
  const { data } = await adminApi.get<Paginated<AdminTrip>>('/admin/trips', { params })
  return data
}

export async function fetchAdminReservations(params: Params = {}): Promise<Paginated<AdminReservation>> {
  const { data } = await adminApi.get<Paginated<AdminReservation>>('/admin/reservations', { params })
  return data
}

export async function fetchAdminPayments(params: Params = {}): Promise<Paginated<AdminPayment>> {
  const { data } = await adminApi.get<Paginated<AdminPayment>>('/admin/payments', { params })
  return data
}

export async function fetchAuditLogs(params: Params = {}): Promise<Paginated<AuditLogEntry>> {
  const { data } = await adminApi.get<Paginated<AuditLogEntry>>('/admin/audit-logs', { params })
  return data
}

/* Référentiels ----------------------------------------------------------- */

export async function createCity(name: string): Promise<City> {
  const { data } = await adminApi.post<Envelope<City>>('/admin/cities', { name })
  return data.data
}

export async function renameCity(id: number, name: string): Promise<City> {
  const { data } = await adminApi.patch<Envelope<City>>(`/admin/cities/${id}`, { name })
  return data.data
}

export async function fetchAdminRoutes(params: Params = {}): Promise<Paginated<RouteRecord>> {
  const { data } = await adminApi.get<Paginated<RouteRecord>>('/admin/routes', { params: { per_page: 100, ...params } })
  return data
}

export async function createAdminRoute(payload: {
  departure_city_id: number
  destination_city_id: number
  estimated_duration_minutes?: number | null
  distance_km?: number | null
}): Promise<RouteRecord> {
  const { data } = await adminApi.post<Envelope<RouteRecord>>('/admin/routes', payload)
  return data.data
}

export async function updateAdminRoute(
  id: number,
  payload: { estimated_duration_minutes?: number | null; distance_km?: number | null; status?: RecordStatus },
): Promise<RouteRecord> {
  const { data } = await adminApi.patch<Envelope<RouteRecord>>(`/admin/routes/${id}`, payload)
  return data.data
}
