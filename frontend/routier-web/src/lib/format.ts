/**
 * Mise en forme pour l'affichage (français, heure du Cameroun, FCFA).
 */

export const TIME_ZONE = 'Africa/Douala'
const LOCALE = 'fr-FR'

const priceFormatter = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 })

/** 7000 → « 7 000 FCFA » */
export function formatPrice(amount: number): string {
  return `${priceFormatter.format(amount)} FCFA`
}

/** « 2026-09-25 » → « jeudi 25 septembre 2026 » */
export function formatDate(date: string, style: 'long' | 'short' = 'long'): string {
  const [year, month, day] = date.split('-').map(Number)
  // Midi UTC : aucun décalage de jour possible, quel que soit le fuseau du navigateur.
  const value = new Date(Date.UTC(year, month - 1, day, 12))
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: 'UTC',
    ...(style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : { weekday: 'short', day: 'numeric', month: 'short' }),
  }).format(value)
}

/** Horodatage ISO → « 25/09/2026 à 06:00 » (heure du Cameroun). */
export function formatDateTime(iso: string): string {
  const value = new Date(iso)
  const date = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, dateStyle: 'short' }).format(value)
  const time = formatTime(iso)
  return `${date} à ${time}`
}

/** Horodatage ISO → « 06:00 » (heure du Cameroun). */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

/** 330 → « 5 h 30 » ; 60 → « 1 h » ; 45 → « 45 min » */
export function formatDuration(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`
}

/** Date du jour au Cameroun, format AAAA-MM-JJ (valeur min des champs date). */
export function todayInCameroon(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(now)
}

/** Ajoute des jours à une date AAAA-MM-JJ. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const value = new Date(Date.UTC(year, month - 1, day + days, 12))
  return value.toISOString().slice(0, 10)
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count > 1 ? plural : singular}`
}

/**
 * Prénom (premier mot du nom complet) pour les messages d'accueil.
 */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName
}
