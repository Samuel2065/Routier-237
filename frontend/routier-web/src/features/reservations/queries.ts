import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelMyReservation,
  createReservation,
  fetchMyReservation,
  fetchMyReservations,
  type CreateReservationPayload,
} from '@/api/reservations'
import { queryKeys } from '@/lib/query-keys'
import type { ReservationStatus } from '@/types/api'

export function useMyReservations(params: { status?: ReservationStatus; page?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.myReservations(params),
    queryFn: () => fetchMyReservations(params),
    placeholderData: keepPreviousData,
  })
}

export function useMyReservation(id: number) {
  return useQuery({
    queryKey: queryKeys.myReservation(id),
    queryFn: () => fetchMyReservation(id),
    enabled: Number.isInteger(id) && id > 0,
  })
}

export function useCreateReservation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateReservationPayload) => createReservation(payload),
    onSuccess: (reservation, payload) => {
      queryClient.setQueryData(queryKeys.myReservation(reservation.id), reservation)
      queryClient.invalidateQueries({ queryKey: queryKeys.myReservationsAll })
      // Les places restantes du trajet ont changé.
      queryClient.invalidateQueries({ queryKey: queryKeys.trip(payload.trip_id) })
      queryClient.invalidateQueries({ queryKey: ['trips', 'search'] })
    },
  })
}

export function useCancelReservation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => cancelMyReservation(id),
    onSuccess: (reservation) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myReservation(reservation.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.myReservationsAll })
      if (reservation.trip) {
        queryClient.invalidateQueries({ queryKey: queryKeys.trip(reservation.trip.id) })
      }
    },
  })
}
