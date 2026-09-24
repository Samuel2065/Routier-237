import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelAgencyReservation,
  createAgency,
  createEmployee,
  createRoute,
  createTrip,
  createVehicle,
  deleteTrip,
  deleteVehicle,
  fetchAgencyPayments,
  fetchAgencyReservation,
  fetchAgencyReservations,
  fetchDashboard,
  fetchEmployees,
  fetchManagedAgencies,
  fetchOrganization,
  fetchRoutes,
  fetchTrips,
  fetchVehicles,
  refundPayment,
  runTripAction,
  updateAgency,
  updateAgencySettings,
  updateEmployee,
  updateOrganization,
  updateTrip,
  updateVehicle,
  type AgencyInput,
  type EmployeeInput,
  type PaymentFilters,
  type ReservationFilters,
  type TripAction,
  type TripFilters,
  type TripInput,
  type VehicleInput,
} from '@/api/agency'

/**
 * Données de l'espace agence. Toutes les clés commencent par « agency » :
 * elles sont purgées à la déconnexion.
 */
export const agencyKeys = {
  dashboard: (agencyId?: number) => ['agency', 'dashboard', agencyId ?? 'all'] as const,
  agencies: ['agency', 'agencies'] as const,
  organization: (id: number) => ['agency', 'organization', id] as const,
  routes: ['agency', 'routes'] as const,
  trips: (filters: TripFilters = {}) => ['agency', 'trips', filters] as const,
  tripsAll: ['agency', 'trips'] as const,
  vehicles: (filters: object = {}) => ['agency', 'vehicles', filters] as const,
  vehiclesAll: ['agency', 'vehicles'] as const,
  employees: (filters: object = {}) => ['agency', 'employees', filters] as const,
  employeesAll: ['agency', 'employees'] as const,
  reservations: (filters: ReservationFilters = {}) => ['agency', 'reservations', filters] as const,
  reservationsAll: ['agency', 'reservations'] as const,
  reservation: (id: number) => ['agency', 'reservation', id] as const,
  payments: (filters: PaymentFilters = {}) => ['agency', 'payments', filters] as const,
  paymentsAll: ['agency', 'payments'] as const,
}

/* Lectures ----------------------------------------------------------------- */

export function useDashboard(agencyId?: number) {
  return useQuery({ queryKey: agencyKeys.dashboard(agencyId), queryFn: () => fetchDashboard(agencyId), refetchInterval: 60_000 })
}

export function useManagedAgencies(enabled = true) {
  return useQuery({ queryKey: agencyKeys.agencies, queryFn: () => fetchManagedAgencies(), enabled, staleTime: 5 * 60_000 })
}

export function useOrganization(id: number | undefined) {
  return useQuery({ queryKey: agencyKeys.organization(id ?? 0), queryFn: () => fetchOrganization(id as number), enabled: !!id })
}

export function useRoutes(enabled = true) {
  return useQuery({ queryKey: agencyKeys.routes, queryFn: () => fetchRoutes(), enabled, staleTime: 5 * 60_000 })
}

export function useTrips(filters: TripFilters) {
  return useQuery({ queryKey: agencyKeys.trips(filters), queryFn: () => fetchTrips(filters), placeholderData: keepPreviousData })
}

export function useVehicles(filters: Record<string, string | number | undefined> = {}, enabled = true) {
  return useQuery({
    queryKey: agencyKeys.vehicles(filters),
    queryFn: () => fetchVehicles(filters),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useEmployees(filters: Record<string, string | number | undefined> = {}) {
  return useQuery({ queryKey: agencyKeys.employees(filters), queryFn: () => fetchEmployees(filters), placeholderData: keepPreviousData })
}

export function useAgencyReservations(filters: ReservationFilters) {
  return useQuery({
    queryKey: agencyKeys.reservations(filters),
    queryFn: () => fetchAgencyReservations(filters),
    placeholderData: keepPreviousData,
  })
}

export function useAgencyReservation(id: number | null) {
  return useQuery({ queryKey: agencyKeys.reservation(id ?? 0), queryFn: () => fetchAgencyReservation(id as number), enabled: !!id })
}

export function useAgencyPayments(filters: PaymentFilters) {
  return useQuery({ queryKey: agencyKeys.payments(filters), queryFn: () => fetchAgencyPayments(filters), placeholderData: keepPreviousData })
}

/* Écritures ------------------------------------------------------------------ */

function useInvalidate() {
  const queryClient = useQueryClient()
  return (...keys: readonly (readonly unknown[])[]) => {
    for (const key of keys) queryClient.invalidateQueries({ queryKey: key })
    queryClient.invalidateQueries({ queryKey: ['agency', 'dashboard'] })
  }
}

export function useSaveTrip() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: TripInput }) => (id ? updateTrip(id, input) : createTrip(input)),
    onSuccess: () => invalidate(agencyKeys.tripsAll, agencyKeys.vehiclesAll),
  })
}

export function useTripAction() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: TripAction }) => runTripAction(id, action),
    onSuccess: () => invalidate(agencyKeys.tripsAll, agencyKeys.reservationsAll),
  })
}

export function useDeleteTrip() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: deleteTrip, onSuccess: () => invalidate(agencyKeys.tripsAll) })
}

export function useCreateRoute() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: createRoute, onSuccess: () => invalidate(agencyKeys.routes) })
}

export function useSaveVehicle() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: VehicleInput }) => (id ? updateVehicle(id, input) : createVehicle(input)),
    onSuccess: () => invalidate(agencyKeys.vehiclesAll),
  })
}

export function useDeleteVehicle() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: deleteVehicle, onSuccess: () => invalidate(agencyKeys.vehiclesAll) })
}

export function useSaveEmployee() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: EmployeeInput }) => (id ? updateEmployee(id, input) : createEmployee(input)),
    onSuccess: () => invalidate(agencyKeys.employeesAll),
  })
}

export function useCancelAgencyReservation() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: cancelAgencyReservation,
    onSuccess: (reservation) => invalidate(agencyKeys.reservationsAll, agencyKeys.reservation(reservation.id), agencyKeys.tripsAll),
  })
}

export function useRefundPayment() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: refundPayment, onSuccess: () => invalidate(agencyKeys.paymentsAll, agencyKeys.reservationsAll) })
}

export function useSaveAgency() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: AgencyInput }) => (id ? updateAgency(id, input) : createAgency(input)),
    onSuccess: () => invalidate(agencyKeys.agencies, ['agency', 'organization']),
  })
}

export function useUpdateAgencySettings() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Parameters<typeof updateAgencySettings>[1] }) => updateAgencySettings(id, input),
    onSuccess: () => invalidate(agencyKeys.agencies),
  })
}

export function useUpdateOrganization() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Parameters<typeof updateOrganization>[1] }) => updateOrganization(id, input),
    onSuccess: (organization) => invalidate(agencyKeys.organization(organization.id)),
  })
}
