import { z } from 'zod'
import type { TripSearchParams } from '@/api/trips'
import { todayInCameroon } from '@/lib/format'

export const MAX_SEARCH_PASSENGERS = 20

/**
 * Formulaire de recherche (§5.1) : départ, arrivée, date, nombre de passagers.
 */
export const searchSchema = z
  .object({
    departure_city_id: z.number({ error: 'Choisissez la ville de départ.' }).int().positive({ error: 'Choisissez la ville de départ.' }),
    destination_city_id: z.number({ error: "Choisissez la ville d'arrivée." }).int().positive({ error: "Choisissez la ville d'arrivée." }),
    date: z.string({ error: 'Choisissez une date.' }).regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Choisissez une date.' }),
    passengers: z
      .number({ error: 'Indiquez le nombre de passagers.' })
      .int()
      .min(1, { error: 'Au moins 1 passager.' })
      .max(MAX_SEARCH_PASSENGERS, { error: `${MAX_SEARCH_PASSENGERS} passagers au maximum.` }),
  })
  .refine((values) => values.departure_city_id !== values.destination_city_id, {
    path: ['destination_city_id'],
    error: "La ville d'arrivée doit être différente de la ville de départ.",
  })
  .refine((values) => values.date >= todayInCameroon(), {
    path: ['date'],
    error: 'La date ne peut pas être dans le passé.',
  })

export type SearchFormValues = z.infer<typeof searchSchema>

/**
 * Critères de recherche lus depuis l'URL (/search?...). null si incomplets ou invalides.
 */
export function parseSearchParams(params: URLSearchParams): TripSearchParams | null {
  const candidate = {
    departure_city_id: Number(params.get('departure_city_id')),
    destination_city_id: Number(params.get('destination_city_id')),
    date: params.get('date') ?? '',
    passengers: Number(params.get('passengers') ?? '1'),
  }

  const parsed = searchSchema.safeParse(candidate)
  if (!parsed.success) return null

  const sort = params.get('sort')
  const travelClassId = Number(params.get('travel_class_id'))

  return {
    ...parsed.data,
    ...(sort === 'price' ? { sort: 'price' as const } : {}),
    ...(Number.isInteger(travelClassId) && travelClassId > 0 ? { travel_class_id: travelClassId } : {}),
  }
}

export function toSearchQuery(values: Partial<TripSearchParams>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value))
    }
  }
  return query.toString()
}
