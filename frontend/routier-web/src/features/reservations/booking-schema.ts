import { z } from 'zod'
import type { PassengerInput } from '@/api/reservations'
import { todayInCameroon } from '@/lib/format'
import { isValidPhone, normalizePhone } from '@/lib/validation'

/** Limite de l'API par réservation. */
export const MAX_PASSENGERS_PER_BOOKING = 20

const passengerSchema = z.object({
  full_name: z.string().trim().min(2, { error: 'Indiquez le nom complet du passager.' }).max(150, { error: '150 caractères au maximum.' }),
  passenger_type: z.enum(['adult', 'child'], { error: 'Choisissez le type de passager.' }),
  phone: z
    .string()
    .trim()
    .refine((value) => value === '' || isValidPhone(value), { error: 'Numéro camerounais invalide.' }),
  birth_date: z
    .string()
    .refine((value) => value === '' || (/^\d{4}-\d{2}-\d{2}$/.test(value) && value < todayInCameroon()), {
      error: 'La date de naissance doit être passée.',
    }),
})

export type PassengerFormValues = z.infer<typeof passengerSchema>

/**
 * Réservation de plusieurs passagers (§9) : enfants sans compte, pas de siège (V1).
 * Le nombre maximal suit les places restantes affichées ; la capacité réelle est
 * contrôlée par l'API sous verrou.
 */
export function makeBookingSchema(maxPassengers: number) {
  const max = Math.max(1, Math.min(MAX_PASSENGERS_PER_BOOKING, maxPassengers))

  return z.object({
    passengers: z
      .array(passengerSchema)
      .min(1, { error: 'Ajoutez au moins un passager.' })
      .max(max, { error: `${max} passager(s) au maximum pour ce trajet.` }),
  })
}

export type BookingFormValues = { passengers: PassengerFormValues[] }

export function emptyPassenger(type: PassengerFormValues['passenger_type'] = 'adult'): PassengerFormValues {
  return { full_name: '', passenger_type: type, phone: '', birth_date: '' }
}

/** Conversion vers la charge utile de l'API (champs vides → null). */
export function toPassengerPayload(values: PassengerFormValues): PassengerInput {
  return {
    full_name: values.full_name.trim(),
    passenger_type: values.passenger_type,
    phone: values.phone.trim() === '' ? null : normalizePhone(values.phone),
    birth_date: values.birth_date === '' ? null : values.birth_date,
  }
}
