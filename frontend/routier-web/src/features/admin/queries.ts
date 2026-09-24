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
  fetchAdminRoutes,
  fetchAdminUsers,
  fetchOrganizations,
  loginAdmin,
  logoutAdmin,
  renameCity,
  updateAdminAgency,
  updateAdminOrganization,
  updateAdminRoute,
  updateAdminUserStatus,
  type AdminAgencyInput,
  type OrganizationInput,
} from '@/api/admin'
import { queryKeys } from '@/lib/query-keys'
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
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      try {
        await logoutAdmin()
      } catch {
        // Session locale fermée dans tous les cas.
      }
    },
    onSettled: () => {
      useAuthStore.getState().clearSession('admin')
      queryClient.removeQueries({ queryKey: ['admin'] })
    },
  })
}

/* Lectures ----------------------------------------------------------------- */

export function useAdminDashboard() {
  return useQuery({ queryKey: adminKeys.dashboard, queryFn: fetchAdminDashboard, refetchInterval: 60_000 })
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
    onSuccess: () => invalidate(adminKeys.usersAll),
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
