import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteNotification, fetchNotifications } from '@/api/notifications'
import { NotificationList } from '@/features/notifications/notification-list'
import { freshNotifications, notificationLink } from '@/features/notifications/notification-meta'
import { NotificationToasts } from '@/features/notifications/notification-toasts'
import { renderWithProviders } from '@/test/render'
import type { AppNotification, NotificationPage } from '@/types/api'

vi.mock('@/api/notifications', () => ({
  fetchNotifications: vi.fn(),
  markNotificationRead: vi.fn(async () => {}),
  markAllNotificationsRead: vi.fn(async () => {}),
  deleteNotification: vi.fn(async () => {}),
}))

vi.mock('sonner', () => ({ toast: vi.fn() }))

// Pas de temps réel dans ces tests : seule la logique des toasts est vérifiée.
vi.mock('@/features/realtime/live-updates', () => ({ useLiveUpdates: vi.fn() }))

function notification(id: string, overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id,
    type: 'agency_reservation_confirmed',
    data: { message: `Nouvelle réservation confirmée R237-${id}.`, reference: `R237-${id}`, reservation_id: 1 },
    read_at: null,
    created_at: '2026-10-04T10:00:00+01:00',
    ...overrides,
  }
}

function page(items: AppNotification[]): NotificationPage {
  return { data: items, current_page: 1, last_page: 1, total: items.length, unread_count: items.filter((item) => !item.read_at).length }
}

describe('freshNotifications', () => {
  it('announces nothing on first load: the history is already known', () => {
    const { fresh, seen } = freshNotifications([notification('a'), notification('b')], null)
    expect(fresh).toEqual([])
    expect([...seen]).toEqual(['a', 'b'])
  })

  it('announces each new unread notification once, oldest first', () => {
    const first = freshNotifications([notification('a')], null)
    const second = freshNotifications([notification('c'), notification('b'), notification('a')], first.seen)
    expect(second.fresh.map((item) => item.id)).toEqual(['b', 'c'])

    const third = freshNotifications([notification('c'), notification('b'), notification('a')], second.seen)
    expect(third.fresh).toEqual([])
  })

  it('never announces a notification already read elsewhere', () => {
    const first = freshNotifications([], null)
    expect(freshNotifications([notification('a', { read_at: '2026-10-04T10:01:00+01:00' })], first.seen).fresh).toEqual([])
  })
})

describe('notificationLink', () => {
  it('opens the matching page of each space', () => {
    expect(notificationLink('customer', notification('a', { type: 'reservation_confirmed' }))).toBe('/account/reservations/1')
    expect(notificationLink('agency', notification('a'))).toBe('/agency/reservations?search=R237-a')
    expect(notificationLink('agency', notification('a', { type: 'agency_refund_required' }))).toBe('/agency/payments?requires_refund=1')
  })
})

describe('NotificationToasts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a toast automatically for a new notification, and only once', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    vi.mocked(fetchNotifications).mockResolvedValueOnce(page([notification('old')]))
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NotificationToasts space="agency" userId={1} />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    // Premier chargement terminé : l'historique existant ne déclenche aucun toast.
    await waitFor(() => expect(queryClient.getQueryState(['agency', 'notifications', {}])?.status).toBe('success'))
    expect(toast).not.toHaveBeenCalled()

    // Nouvelle notification (signal temps réel, push ou interrogation) : la liste est relue.
    vi.mocked(fetchNotifications).mockResolvedValue(page([notification('new'), notification('old')]))
    await act(() => queryClient.invalidateQueries())

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1))
    expect(toast).toHaveBeenCalledWith(
      'Nouvelle réservation',
      expect.objectContaining({ id: 'notification-new', description: 'Nouvelle réservation confirmée R237-new.', duration: 8000 }),
    )

    // Même notification signalée une seconde fois (Reverb puis push, par exemple) : aucun doublon.
    await act(() => queryClient.invalidateQueries())
    await waitFor(() => expect(fetchNotifications).toHaveBeenCalledTimes(3))
    expect(toast).toHaveBeenCalledTimes(1)
  })
})

describe('NotificationList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes a notification on the server, for the current space', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchNotifications).mockResolvedValue(page([notification('a')]))
    renderWithProviders(<NotificationList space="agency" />)

    await user.click(await screen.findByRole('button', { name: 'Supprimer la notification' }))

    expect(deleteNotification).toHaveBeenCalledWith('agency', 'a')
    expect(screen.getByText('Nouvelle réservation')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ouvrir' })).toHaveAttribute('href', '/agency/reservations?search=R237-a')
  })
})
