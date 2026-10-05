import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PushNotificationsCard } from '@/features/notifications/push-notifications-card'
import { disablePush, enablePush, isOptedIn, pushSupport } from '@/lib/push'

vi.mock('@/lib/push', () => ({
  pushConfigured: true,
  pushSupport: vi.fn(),
  isOptedIn: vi.fn(),
  enablePush: vi.fn(),
  disablePush: vi.fn(),
}))

function setPermission(permission: NotificationPermission) {
  vi.stubGlobal('Notification', { permission, requestPermission: vi.fn() })
}

describe('PushNotificationsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(pushSupport).mockResolvedValue('ok')
    vi.mocked(isOptedIn).mockReturnValue(false)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('explains first and asks the browser permission only after a click', async () => {
    const user = userEvent.setup()
    setPermission('default')
    vi.mocked(enablePush).mockResolvedValue('granted')
    render(<PushNotificationsCard space="agency" userId={7} />)

    expect(await screen.findByText(/même lorsque Routier\+237 est fermé ou en arrière-plan/)).toBeInTheDocument()
    expect(enablePush).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Activer' }))

    expect(enablePush).toHaveBeenCalledWith('agency', 7)
    expect(await screen.findByRole('button', { name: 'Désactiver' })).toBeInTheDocument()
  })

  it('stays usable when the user refuses the permission', async () => {
    const user = userEvent.setup()
    setPermission('default')
    vi.mocked(enablePush).mockImplementation(async () => {
      setPermission('denied')
      return 'denied'
    })
    render(<PushNotificationsCard space="customer" userId={3} />)

    await user.click(await screen.findByRole('button', { name: 'Activer' }))

    expect(await screen.findByText(/bloquées pour ce site/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Activer' })).not.toBeInTheDocument()
  })

  it('lets the account turn push off on this device', async () => {
    const user = userEvent.setup()
    setPermission('granted')
    vi.mocked(isOptedIn).mockReturnValue(true)
    vi.mocked(disablePush).mockResolvedValue()
    render(<PushNotificationsCard space="customer" userId={3} />)

    await user.click(await screen.findByRole('button', { name: 'Désactiver' }))

    expect(disablePush).toHaveBeenCalledWith('customer', 3)
    expect(await screen.findByRole('button', { name: 'Activer' })).toBeInTheDocument()
  })

  it('shows an explicit error when the registration fails', async () => {
    const user = userEvent.setup()
    setPermission('default')
    vi.mocked(enablePush).mockRejectedValue(new Error('réseau'))
    render(<PushNotificationsCard space="customer" userId={3} />)

    await user.click(await screen.findByRole('button', { name: 'Activer' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("L'opération n'a pas abouti")
  })

  it('explains the limits of browsers without push support', async () => {
    vi.mocked(pushSupport).mockResolvedValue('unsupported')
    render(<PushNotificationsCard space="customer" userId={3} />)

    expect(await screen.findByText(/ne permet pas les notifications push/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('requires a secure connection (HTTPS)', async () => {
    vi.mocked(pushSupport).mockResolvedValue('insecure')
    render(<PushNotificationsCard space="customer" userId={3} />)

    await waitFor(() => expect(screen.getByText(/connexion sécurisée \(HTTPS\)/)).toBeInTheDocument())
  })
})
