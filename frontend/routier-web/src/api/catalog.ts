import { publicApi } from '@/api/client'
import type { City, Envelope, Paginated, PublicAgency, PublicTrip, TravelClass } from '@/types/api'

/** Référentiels et agences publiques (sans compte). */

export async function fetchCities(): Promise<City[]> {
  const { data } = await publicApi.get<Envelope<City[]>>('/cities')
  return data.data
}

export async function fetchTravelClasses(): Promise<TravelClass[]> {
  const { data } = await publicApi.get<Envelope<TravelClass[]>>('/travel-classes')
  return data.data
}

export async function fetchAgencies(params: { city_id?: number; search?: string; page?: number } = {}): Promise<Paginated<PublicAgency>> {
  const { data } = await publicApi.get<Paginated<PublicAgency>>('/agencies', { params })
  return data
}

export async function fetchAgency(id: number): Promise<PublicAgency> {
  const { data } = await publicApi.get<Envelope<PublicAgency>>(`/agencies/${id}`)
  return data.data
}

export async function fetchAgencyTrips(id: number, page = 1): Promise<Paginated<PublicTrip>> {
  const { data } = await publicApi.get<Paginated<PublicTrip>>(`/agencies/${id}/trips`, { params: { page } })
  return data
}
