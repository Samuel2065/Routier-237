import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchCities, fetchTravelClasses } from '@/api/catalog'
import { fetchTrip, searchTrips, type TripSearchParams } from '@/api/trips'
import { queryKeys } from '@/lib/query-keys'

export function useCities() {
  return useQuery({ queryKey: queryKeys.cities, queryFn: fetchCities, staleTime: 60 * 60 * 1000 })
}

export function useTravelClasses() {
  return useQuery({ queryKey: queryKeys.travelClasses, queryFn: fetchTravelClasses, staleTime: 60 * 60 * 1000 })
}

/** Recherche publique ; désactivée tant que les critères sont incomplets. */
export function useTripSearch(params: TripSearchParams | null) {
  return useQuery({
    queryKey: params ? queryKeys.tripSearch(params) : ['trips', 'search', 'idle'],
    queryFn: () => searchTrips(params as TripSearchParams),
    enabled: params !== null,
    placeholderData: keepPreviousData,
  })
}

export function useTrip(id: number) {
  return useQuery({
    queryKey: queryKeys.trip(id),
    queryFn: () => fetchTrip(id),
    enabled: Number.isInteger(id) && id > 0,
  })
}
