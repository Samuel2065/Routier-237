import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { fetchAgencies, fetchAgency, fetchAgencyTrips } from '@/api/catalog'
import { queryKeys } from '@/lib/query-keys'

export function useAgencies(params: { city_id?: number; search?: string } = {}) {
  return useQuery({ queryKey: queryKeys.agencies(params), queryFn: () => fetchAgencies(params) })
}

export function useAgency(id: number) {
  return useQuery({
    queryKey: queryKeys.agency(id),
    queryFn: () => fetchAgency(id),
    enabled: Number.isInteger(id) && id > 0,
  })
}

/** Trajets publiés à venir d'une agence, chargés page par page (« Voir plus »). */
export function useAgencyTrips(id: number) {
  return useInfiniteQuery({
    queryKey: queryKeys.agencyTrips(id),
    queryFn: ({ pageParam }) => fetchAgencyTrips(id, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
    enabled: Number.isInteger(id) && id > 0,
  })
}
