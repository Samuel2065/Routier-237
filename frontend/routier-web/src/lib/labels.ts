import type { PassengerType, PaymentMethod, PaymentStatus, ReservationStatus } from '@/types/api'

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: 'En attente de paiement',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
  expired: 'Expirée',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Créé',
  processing: 'En cours',
  paid: 'Payé',
  failed: 'Échoué',
  cancelled: 'Annulé',
  refunded: 'Remboursé',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  orange_money: 'Orange Money',
  mtn_momo: 'MTN MoMo',
  card: 'Carte bancaire',
}

export const PASSENGER_TYPE_LABELS: Record<PassengerType, string> = {
  adult: 'Adulte',
  child: 'Enfant',
}
