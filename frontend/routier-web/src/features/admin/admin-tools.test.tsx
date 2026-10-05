import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchAdminUser, fetchAuditLogs, sendPasswordResetLink } from '@/api/admin'
import { auditActionLabel, auditDetails } from '@/features/admin/audit-labels'
import { AdminUserSheet } from '@/features/admin/user-sheet'
import { renderWithProviders } from '@/test/render'
import type { AdminUser, AuditLogEntry } from '@/types/api'

vi.mock('@/api/admin', () => ({ fetchAdminUser: vi.fn(), fetchAuditLogs: vi.fn(), sendPasswordResetLink: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const manager: AdminUser = {
  id: 5,
  name: 'Paul Manager',
  email: 'manager.bertoua@routier237.test',
  phone: '699112233',
  status: 'active',
  role: 'agency_manager',
  organization: { id: 1, name: 'Routier Démo Voyages' },
  agency: { id: 2, name: 'Agence Bertoua Centre' },
  created_at: '2026-01-01T00:00:00Z',
  permissions: ['reservations.view', 'trips.publish'],
  last_active_at: '2026-10-05T09:00:00+01:00',
  active_sessions: 1,
  push_devices: 0,
}

function entry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: 1,
    action: 'user.suspended',
    actor: { id: 1, name: 'Administrateur', role: 'super_admin' },
    subject: { type: 'user', id: 5, label: 'Paul Manager' },
    metadata: { fields: ['status'], status: { from: 'active', to: 'suspended' } },
    ip_address: '127.0.0.1',
    created_at: '2026-10-05T10:00:00+01:00',
    ...overrides,
  }
}

describe('AdminUserSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchAdminUser).mockResolvedValue(manager)
    vi.mocked(fetchAuditLogs).mockResolvedValue({ data: [entry()], meta: { current_page: 1, last_page: 1, per_page: 5, total: 1 } })
  })

  it('shows the role permissions read-only and the account history', async () => {
    renderWithProviders(<AdminUserSheet userId={5} currentAdminId={1} onClose={() => {}} />)

    expect(await screen.findByText('trips.publish')).toBeInTheDocument()
    expect(screen.getByText(/Lecture seule : les rôles du personnel se gèrent dans l'espace agence/)).toBeInTheDocument()
    expect(await screen.findByText('Compte suspendu')).toBeInTheDocument()
    expect(fetchAuditLogs).toHaveBeenCalledWith({ subject_type: 'user', subject_id: 5, per_page: 5 })
  })

  it('sends a reset link after confirmation, never showing a password', async () => {
    const user = userEvent.setup()
    vi.mocked(sendPasswordResetLink).mockResolvedValue('Un lien de réinitialisation a été envoyé à manager.bertoua@routier237.test.')
    renderWithProviders(<AdminUserSheet userId={5} currentAdminId={1} onClose={() => {}} />)

    await user.click(await screen.findByRole('button', { name: 'Envoyer un lien de réinitialisation' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/La personne choisira elle-même son nouveau mot de passe/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Envoyer le lien' }))

    expect(sendPasswordResetLink).toHaveBeenCalledWith(5)
    // Aucun champ de mot de passe : l'administrateur ne le voit ni ne le choisit.
    expect(document.querySelector('input[type="password"]')).toBeNull()
  })

  it('does not offer the reset link for the admin own account', async () => {
    vi.mocked(fetchAdminUser).mockResolvedValue({ ...manager, id: 1, role: 'super_admin' })
    renderWithProviders(<AdminUserSheet userId={1} currentAdminId={1} onClose={() => {}} />)

    expect(await screen.findByText(/utilisez « Mot de passe oublié \? »/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Envoyer un lien de réinitialisation' })).not.toBeInTheDocument()
  })

  it('loads nothing while closed', () => {
    renderWithProviders(<AdminUserSheet userId={null} onClose={() => {}} />)

    expect(fetchAdminUser).not.toHaveBeenCalled()
    expect(fetchAuditLogs).not.toHaveBeenCalled()
  })
})

describe('audit labels', () => {
  it('describes each action and its details in French', () => {
    expect(auditActionLabel('user.password_reset_link_sent')).toBe('Lien de réinitialisation envoyé')
    expect(auditActionLabel('action.inconnue')).toBe('action.inconnue')
    expect(auditDetails(entry())).toEqual(['Statut : actif → suspendu', 'Champs : status'])
    expect(auditDetails(entry({ action: 'employee.updated', metadata: { fields: ['phone'], password_changed: true, role: 'driver' } }))).toEqual([
      'Rôle : Conducteur',
      'Champs : phone',
      'Mot de passe changé',
    ])
  })
})
