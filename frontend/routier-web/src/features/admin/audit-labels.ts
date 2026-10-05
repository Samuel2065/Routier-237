import { formatPrice } from '@/lib/format'
import { ROLE_LABELS } from '@/lib/labels'
import type { AuditLogEntry, RoleName } from '@/types/api'

/** Libellés des actions du journal d'audit (backend : AuditLog::record). */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'user.suspended': 'Compte suspendu',
  'user.reactivated': 'Compte réactivé',
  'user.updated': 'Compte modifié',
  'user.password_reset_link_sent': 'Lien de réinitialisation envoyé',
  'user.password_reset_requested': 'Réinitialisation demandée (mot de passe oublié)',
  'user.password_reset': 'Mot de passe réinitialisé',
  'organization.created': 'Organisation créée',
  'organization.updated': 'Organisation modifiée',
  'organization.suspended': 'Organisation suspendue',
  'organization.reactivated': 'Organisation réactivée',
  'agency.created': 'Agence créée',
  'agency.updated': 'Agence modifiée',
  'agency.suspended': 'Agence suspendue',
  'agency.reactivated': 'Agence réactivée',
  'agency_settings.updated': "Paramètres d'agence modifiés",
  'director.created': 'Directeur créé',
  'employee.created': 'Membre du personnel créé',
  'employee.updated': 'Fiche du personnel modifiée',
  'reservation.cancelled_by_agency': "Réservation annulée par l'agence",
  'payment.refunded': 'Paiement remboursé',
  'trip.cancelled': 'Trajet annulé',
}

/** Catégories du filtre (préfixe d'action). */
export const AUDIT_CATEGORIES: [string, string][] = [
  ['user.', 'Comptes et mots de passe'],
  ['organization.', 'Organisations'],
  ['agency', 'Agences'],
  ['director.', 'Directeurs'],
  ['employee.', 'Personnel'],
  ['reservation.', 'Réservations'],
  ['payment.', 'Paiements'],
  ['trip.', 'Trajets'],
]

const STATUS_LABELS: Record<string, string> = {
  active: 'actif',
  inactive: 'inactif',
  suspended: 'suspendu',
  terminated: 'parti',
}

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action
}

/**
 * Résumé lisible des métadonnées (jamais de valeur sensible : le backend n'en enregistre pas).
 */
export function auditDetails(entry: AuditLogEntry): string[] {
  const metadata = entry.metadata as Record<string, unknown>
  const details: string[] = []

  const status = metadata.status
  if (status && typeof status === 'object' && 'to' in status) {
    const { from, to } = status as { from?: string; to?: string }
    details.push(`Statut : ${STATUS_LABELS[from ?? ''] ?? from ?? '—'} → ${STATUS_LABELS[to ?? ''] ?? to}`)
  } else if (typeof status === 'string') {
    details.push(`Statut : ${STATUS_LABELS[status] ?? status}`)
  }
  if (typeof metadata.role === 'string') details.push(`Rôle : ${ROLE_LABELS[metadata.role as RoleName] ?? metadata.role}`)
  if (Array.isArray(metadata.fields) && metadata.fields.length > 0) details.push(`Champs : ${metadata.fields.join(', ')}`)
  if (metadata.password_changed === true) details.push('Mot de passe changé')
  if (typeof metadata.amount === 'number') details.push(`Montant : ${formatPrice(metadata.amount)}`)

  return details
}
