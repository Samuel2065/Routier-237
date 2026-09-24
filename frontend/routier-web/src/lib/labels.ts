import type {
  EmployeeStatus,
  PassengerType,
  PaymentMethod,
  PaymentStatus,
  RecordStatus,
  ReservationStatus,
  RoleName,
  TripStatus,
  VehicleStatus,
} from '@/types/api'

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

export const ROLE_LABELS: Record<RoleName, string> = {
  super_admin: 'Administrateur plateforme',
  director: 'Directeur',
  agency_manager: "Responsable d'agence",
  counter_clerk: 'Agent de guichet',
  accountant: 'Comptable',
  driver: 'Conducteur',
  customer: 'Client',
}

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  draft: 'Brouillon',
  published: 'Publié',
  cancelled: 'Annulé',
  completed: 'Terminé',
}

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  active: 'En service',
  maintenance: 'En maintenance',
  retired: 'Hors service',
}

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: 'Actif',
  suspended: 'Suspendu',
  terminated: 'Parti',
}

export const RECORD_STATUS_LABELS: Record<RecordStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
}
