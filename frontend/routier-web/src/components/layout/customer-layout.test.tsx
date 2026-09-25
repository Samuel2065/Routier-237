import { screen } from '@testing-library/react'
import { vi } from 'vitest'
import { CustomerLayout } from '@/components/layout/customer-layout'
import { renderWithProviders } from '@/test/render'
import { useAuthStore } from '@/store/auth-store'

vi.mock('@/api/notifications', () => ({
  fetchNotifications: vi.fn(async () => ({ data: [], unread_count: 3, meta: { current_page: 1, last_page: 1, per_page: 15, total: 0 } })),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}))

function signInCustomer() {
  useAuthStore.setState({
    sessions: {
      customer: {
        token: '1|test',
        expiresAt: '2099-01-01T00:00:00Z',
        user: {
          id: 9,
          name: 'Awa Nkoulou',
          email: 'awa@example.test',
          phone: null,
          avatar_url: null,
          status: 'active',
          role: 'customer',
          permissions: [],
          organization: null,
          agency: null,
          created_at: '2026-01-01T00:00:00Z',
        },
      },
    },
  })
}

describe('CustomerLayout', () => {
  it('shows the traveller navigation, the account and the unread notifications', async () => {
    signInCustomer()
    renderWithProviders(<CustomerLayout />, { route: '/account' })

    expect(screen.getByRole('navigation', { name: 'Navigation — Espace voyageur' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mes réservations' })).toHaveAttribute('href', '/account/reservations')
    expect(await screen.findByRole('link', { name: 'Notifications, 3 non lue(s)' })).toHaveAttribute('href', '/account#notifications')
    expect(document.documentElement.dataset.space).toBe('customer')
  })
})
