import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createAdminAgency,
  createAdminRoute,
  createCity,
  createDirector,
  createOrganization,
  fetchAdminAgencies,
  fetchAdminDashboard,
  fetchAdminOrganization,
  fetchAdminPayments,
  fetchAdminReservations,
  fetchAdminRoutes,
  fetchAdminTrips,
  fetchAdminUser,
  fetchAdminUsers,
  fetchAuditLogs,
  fetchOrganizations,
  loginAdmin,
  logoutAdmin,
  renameCity,
  sendPasswordResetLink,
  updateAdminAgency,
  updateAdminOrganization,
  updateAdminRoute,
  updateAdminUserStatus,
  type AdminAgencyInput,
  type OrganizationInput,
} from '@/api/admin'
import { queryKeys } from '@/lib/query-keys'
import { useLiveFallbackInterval } from '@/lib/realtime'
import { useAuthStore } from '@/store/auth-store'

/**
 * Données de l'espace administrateur. Toutes les clés commencent par « admin »
 * (purgées à la déconnexion).
 */
export const adminKeys = {
  dashboard: ['admin', 'dashboard'] as const,
  organizations: (filters: object = {}) => ['admin', 'organizations', filters] as const,
  organizationsAll: ['admin', 'organizations'] as const,
  organization: (id: number) => ['admin', 'organization', id] as const,
  agencies: (filters: object = {}) => ['admin', 'agencies', filters] as const,
  agenciesAll: ['admin', 'agencies'] as const,
  users: (filters: object = {}) => ['admin', 'users', filters] as const,
  usersAll: ['admin', 'users'] as const,
  routes: ['admin', 'routes'] as const,
  user: (id: number) => ['admin', 'user', id] as const,
  /** Trajets, réservations et paiements de toute la plateforme (relus à chaque signal « admin »). */
  activity: (kind: 'trips' | 'reservations' | 'payments', filters: object = {}) => ['admin', 'activity', kind, filters] as const,
  auditLogs: (filters: object = {}) => ['admin', 'audit-logs', filters] as const,
}

/* Session ------------------------------------------------------------------ */

export function useAdminLogin() {
  return useMutation({
    mutationFn: loginAdmin,
    onSuccess: (payload) =>
      useAuthStore.getState().setSession('admin', { token: payload.token, expiresAt: payload.expires_at, user: payload.user }),
  })
}

export function useAdminLogout() {
  return useMutation({
    mutationFn: async () => {
      try {
        await logoutAdmin()
      } catch {
        // Session locale fermée dans tous les cas.
      }
    },
    // Le cache est vidé par la surveillance de session (lib/session-watch).
    onSettled: () => useAuthStore.getState().clearSession('admin'),
  })
}

/* Lectures ----------------------------------------------------------------- */

export function useAdminDashboard() {
  return useQuery({ queryKey: adminKeys.dashboard, queryFn: fetchAdminDashboard, refetchInterval: useLiveFallbackInterval() })
}

export function useOrganizations(filters: Record<string, string | number | undefined> = {}) {
  return useQuery({ queryKey: adminKeys.organizations(filters), queryFn: () => fetchOrganizations(filters), placeholderData: keepPreviousData })
}

export function useAdminOrganization(id: number) {
  return useQuery({ queryKey: adminKeys.organization(id), queryFn: () => fetchAdminOrganization(id), enabled: id > 0 })
}

export function useAdminAgencies(filters: Record<string, string | number | undefined> = {}) {
  return useQuery({ queryKey: adminKeys.agencies(filters), queryFn: () => fetchAdminAgencies(filters), placeholderData: keepPreviousData })
}

export function useAdminUsers(filters: Parameters<typeof fetchAdminUsers>[0] = {}) {
  return useQuery({ queryKey: adminKeys.users(filters), queryFn: () => fetchAdminUsers(filters), placeholderData: keepPreviousData })
}

export function useAdminRoutes() {
  return useQuery({ queryKey: adminKeys.routes, queryFn: () => fetchAdminRoutes() })
}

export function useAdminUser(id: number | null) {
  return useQuery({ queryKey: adminKeys.user(id ?? 0), queryFn: () => fetchAdminUser(id as number), enabled: !!id })
}

type Filters = Record<string, string | number | undefined>

export function useAdminTrips(filters: Filters) {
  return useQuery({ queryKey: adminKeys.activity('trips', filters), queryFn: () => fetchAdminTrips(filters), placeholderData: keepPreviousData, refetchInterval: useLiveFallbackInterval() })
}

export function useAdminReservations(filters: Filters) {
  return useQuery({ queryKey: adminKeys.activity('reservations', filters), queryFn: () => fetchAdminReservations(filters), placeholderData: keepPreviousData, refetchInterval: useLiveFallbackInterval() })
}

export function useAdminPayments(filters: Filters) {
  return useQuery({ queryKey: adminKeys.activity('payments', filters), queryFn: () => fetchAdminPayments(filters), placeholderData: keepPreviousData, refetchInterval: useLiveFallbackInterval() })
}

export function useAuditLogs(filters: Filters, enabled = true) {
  return useQuery({ queryKey: adminKeys.auditLogs(filters), queryFn: () => fetchAuditLogs(filters), placeholderData: keepPreviousData, enabled })
}

/* Écritures ------------------------------------------------------------------ */

function useInvalidate() {
  const queryClient = useQueryClient()
  return (...keys: readonly (readonly unknown[])[]) => {
    for (const key of keys) queryClient.invalidateQueries({ queryKey: key })
    queryClient.invalidateQueries({ queryKey: adminKeys.dashboard })
  }
}

export function useSaveOrganization() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: OrganizationInput }) => (id ? updateAdminOrganization(id, input) : createOrganization(input)),
    onSuccess: (organization) => invalidate(adminKeys.organizationsAll, adminKeys.organization(organization.id), adminKeys.agenciesAll),
  })
}

export function useCreateDirector(organizationId: number) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (payload: Parameters<typeof createDirector>[1]) => createDirector(organizationId, payload),
    onSuccess: () => invalidate(adminKeys.organization(organizationId), adminKeys.usersAll),
  })
}

export function useSaveAdminAgency() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: AdminAgencyInput }) => (id ? updateAdminAgency(id, input) : createAdminAgency(input)),
    onSuccess: (agency) => invalidate(adminKeys.agenciesAll, adminKeys.organization(agency.organization_id), adminKeys.organizationsAll),
  })
}

export function useUpdateUserStatus() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'active' | 'suspended' }) => updateAdminUserStatus(id, status),
    onSuccess: (user) => invalidate(adminKeys.usersAll, adminKeys.user(user.id), ['admin', 'audit-logs']),
  })
}

/** Lien de réinitialisation du mot de passe envoyé à la personne (action journalisée). */
export function useSendPasswordReset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => sendPasswordResetLink(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] }),
  })
}

export function useSaveCity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id?: number; name: string }) => (id ? renameCity(id, name) : createCity(name)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.cities }),
  })
}

export function useSaveAdminRoute() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (
      args:
        | { id: number; input: Parameters<typeof updateAdminRoute>[1] }
        | { id?: undefined; input: Parameters<typeof createAdminRoute>[0] },
    ) => (args.id ? updateAdminRoute(args.id, args.input) : createAdminRoute(args.input as Parameters<typeof createAdminRoute>[0])),
    onSuccess: () => invalidate(adminKeys.routes),
  })
}
