import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { fetchAdminUsers, updateAdminUserStatus } from '@/api/admin'
import { AdminUsersPage } from '@/pages/admin/users-page'
import { useAuthStore } from '@/store/auth-store'
import { renderWithProviders } from '@/test/render'
import type { AdminUser, Paginated } from '@/types/api'

vi.mock('@/api/admin', () => ({ fetchAdminUsers: vi.fn(), updateAdminUserStatus: vi.fn() }))

const users: AdminUser[] = [
  { id: 1, name: 'Administrateur', email: 'admin@routier237.test', phone: null, status: 'active', role: 'super_admin', organization: null, agency: null, created_at: '2026-01-01T00:00:00Z' },
  { id: 9, name: 'Client Démo', email: 'client@routier237.test', phone: null, status: 'active', role: 'customer', organization: null, agency: null, created_at: '2026-02-01T00:00:00Z' },
]

describe('AdminUsersPage', () => {
  beforeEach(() => {
    vi.mocked(fetchAdminUsers).mockReset()
    vi.mocked(updateAdminUserStatus).mockReset()
    vi.mocked(fetchAdminUsers).mockImplementation(async () => ({ data: users, meta: { current_page: 1, last_page: 1, per_page: 25, total: 2 } }) as Paginated<AdminUser>)
    useAuthStore.setState({
      sessions: { admin: { token: '1|admin', expiresAt: '2099-01-01T00:00:00Z', user: { ...users[0], avatar_url: null, permissions: [] } } },
    })
  })

  it('suspends an account after confirmation, never the current admin', async () => {
    const user = userEvent.setup()
    vi.mocked(updateAdminUserStatus).mockImplementation(async () => ({ ...users[1], status: 'suspended' }))

    renderWithProviders(<AdminUsersPage />, { route: '/admin/users' })

    const customerRow = (await screen.findByText('Client Démo')).closest('tr') as HTMLElement
    const adminRow = screen.getByText('Administrateur').closest('tr') as HTMLElement
    expect(within(adminRow).queryByRole('button', { name: /Suspendre/ })).not.toBeInTheDocument()

    await user.click(within(customerRow).getByRole('button', { name: /Suspendre/ }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/déconnectée immédiatement/)).toBeInTheDocument()
    expect(updateAdminUserStatus).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Suspendre' }))
    await waitFor(() => expect(updateAdminUserStatus).toHaveBeenCalledWith(9, 'suspended'))
  })
})
