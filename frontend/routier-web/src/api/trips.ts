import { publicApi } from '@/api/client'
import type { Envelope, PublicTrip, SearchMeta } from '@/types/api'

export interface TripSearchParams {
  departure_city_id: number
  destination_city_id: number
  date: string
  passengers?: number
  travel_class_id?: number
  sort?: 'departure' | 'price'
}

export interface TripSearchResult {
  data: PublicTrip[]
  meta: SearchMeta
}

export async function searchTrips(params: TripSearchParams): Promise<TripSearchResult> {
  const { data } = await publicApi.get<TripSearchResult>('/trips/search', { params })
  return data
}

export async function fetchTrip(id: number): Promise<PublicTrip> {
  const { data } = await publicApi.get<Envelope<PublicTrip>>(`/trips/${id}`)
  return data.data
}
