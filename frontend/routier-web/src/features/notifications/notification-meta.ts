import type { NotificationSpace } from '@/api/notifications'
import type { AppNotification, NotificationType } from '@/types/api'

const TITLES: Record<NotificationType, string> = {
  reservation_confirmed: 'Réservation confirmée',
  reservation_cancelled: 'Réservation annulée',
  payment_failed: 'Paiement non abouti',
  agency_reservation_confirmed: 'Nouvelle réservation',
  agency_reservation_cancelled: 'Réservation annulée par le client',
  agency_refund_required: 'Remboursement à effectuer',
}

export function notificationTitle(notification: AppNotification): string {
  return (notification.type && TITLES[notification.type]) || 'Notification'
}

/**
 * Page liée à une notification (null si aucune). L'API revérifie l'accès à l'ouverture.
 */
export function notificationLink(space: NotificationSpace, notification: AppNotification): string | null {
  const { reservation_id: reservationId, reference } = notification.data

  if (space === 'customer') {
    return reservationId ? `/account/reservations/${reservationId}` : null
  }

  if (notification.type === 'agency_refund_required') return '/agency/payments?requires_refund=1'

  return reference ? `/agency/reservations?search=${encodeURIComponent(reference)}` : null
}

/** Au-delà, les notifications arrivées en même temps restent dans le centre sans toast. */
const MAX_TOASTS_AT_ONCE = 3

/**
 * Nouvelles notifications à annoncer : non lues et jamais vues dans cet onglet.
 *
 * Au premier chargement, tout ce qui existe déjà est considéré comme vu (pas de toast pour
 * l'historique). La notification en base est la seule source : qu'elle soit signalée par
 * Reverb, par un message push (FCM) ou par l'interrogation de secours, son identifiant
 * garantit un seul toast.
 */
export function freshNotifications(items: AppNotification[], seen: Set<string> | null): { fresh: AppNotification[]; seen: Set<string> } {
  if (seen === null) return { fresh: [], seen: new Set(items.map((item) => item.id)) }

  const fresh = items.filter((item) => !item.read_at && !seen.has(item.id))
  const next = new Set(seen)
  items.forEach((item) => next.add(item.id))

  return { fresh: fresh.slice(0, MAX_TOASTS_AT_ONCE).reverse(), seen: next }
}
