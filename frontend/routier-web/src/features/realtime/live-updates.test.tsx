import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type LivePayload, queryKeysFor, useLiveUpdates } from '@/features/realtime/live-updates'
import { spaceForChannel } from '@/lib/realtime'

type Listener = (payload: LivePayload) => void

// Faux client Echo : enregistre les abonnements pour simuler la réception d'un signal.
const fake = vi.hoisted(() => {
  const listeners = new Map<string, (payload: unknown) => void>()
  const subscription = (name: string) => ({
    listen: (event: string, callback: (payload: unknown) => void) => {
      listeners.set(`${name}|${event}`, callback)
    },
  })
  const echo = {
    private: vi.fn((name: string) => subscription(`private-${name}`)),
    channel: vi.fn((name: string) => subscription(name)),
    leave: vi.fn(),
  }
  return { listeners, echo, status: { value: 'connected' as string }, statusListeners: new Set<() => void>() }
})

vi.mock('@/lib/realtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/realtime')>()),
  getEcho: () => Promise.resolve(fake.echo),
  getRealtimeStatus: () => fake.status.value,
  subscribeRealtimeStatus: (listener: () => void) => {
    fake.statusListeners.add(listener)
    return () => fake.statusListeners.delete(listener)
  },
}))

function setup(scope: Parameters<typeof useLiveUpdates>[0], channel: string | null) {
  const queryClient = new QueryClient()
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  const hook = renderHook(() => useLiveUpdates(scope, channel), { wrapper })
  return { invalidate, hook }
}

function emit(channel: string, payload: LivePayload) {
  const listener = fake.listeners.get(`${channel}|.live.update`) as Listener | undefined
  expect(listener, `abonnement à ${channel}`).toBeDefined()
  listener?.(payload)
}

describe('queryKeysFor', () => {
  it('maps agency topics to the agency queries only', () => {
    expect(queryKeysFor('agency', { topics: ['reservations', 'dashboard'], ids: { reservation: [4] } })).toEqual([
      ['agency', 'reservations'],
      ['agency', 'reservation'],
      ['agency', 'dashboard'],
    ])
  })

  it('maps customer topics to the account queries', () => {
    expect(queryKeysFor('customer', { topics: ['payments', 'notifications'], ids: {} })).toEqual([
      ['account', 'payment'],
      ['account', 'notifications'],
    ])
  })

  it('refreshes public availability for the given trips, or every trip', () => {
    expect(queryKeysFor('public', { topics: ['availability'], ids: { trip: [7] } })).toEqual([
      ['trips', 'search'],
      ['public-agency'],
      ['trip', 7],
    ])
    expect(queryKeysFor('public', { topics: ['availability'], ids: {} })).toContainEqual(['trip'])
  })

  it('ignores topics that do not concern the space', () => {
    expect(queryKeysFor('admin', { topics: ['reservations'], ids: {} })).toEqual([])
  })
})

describe('spaceForChannel', () => {
  it('authorizes each private channel with the token of its space', () => {
    expect(spaceForChannel('private-agency.3')).toBe('agency')
    expect(spaceForChannel('private-organization.2')).toBe('agency')
    expect(spaceForChannel('private-user.9')).toBe('customer')
    expect(spaceForChannel('private-admin')).toBe('admin')
    expect(spaceForChannel('private-autre')).toBeNull()
  })
})

describe('useLiveUpdates', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fake.listeners.clear()
    fake.status.value = 'connected'
    vi.clearAllMocks()
  })
  afterEach(() => vi.useRealTimers())

  it('invalidates the matching queries once for a burst of signals', async () => {
    const { invalidate } = setup('agency', 'agency.3')
    await act(async () => {})
    expect(fake.echo.private).toHaveBeenCalledWith('agency.3')

    emit('private-agency.3', { topics: ['reservations'], ids: { reservation: [1] } })
    emit('private-agency.3', { topics: ['reservations', 'dashboard'], ids: { reservation: [2] } })
    expect(invalidate).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(300))

    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey)
    expect(keys).toEqual([
      ['agency', 'reservations'],
      ['agency', 'reservation'],
      ['agency', 'dashboard'],
    ])
  })

  it('listens to the public channel without authorization', async () => {
    setup('public', 'trips')
    await act(async () => {})
    expect(fake.echo.channel).toHaveBeenCalledWith('trips')
    expect(fake.echo.private).not.toHaveBeenCalled()
  })

  it('leaves the channel on unmount (sign-out, change of space)', async () => {
    const { hook } = setup('customer', 'user.9')
    await act(async () => {})

    hook.unmount()
    await act(async () => {})

    expect(fake.echo.leave).toHaveBeenCalledWith('user.9')
  })

  it('does nothing without a channel', async () => {
    setup('customer', null)
    await act(async () => {})
    expect(fake.echo.private).not.toHaveBeenCalled()
  })

  it('reloads the space after a lost connection (missed signals)', async () => {
    const { invalidate } = setup('customer', 'user.9')
    await act(async () => {})

    for (const value of ['unavailable', 'connected']) {
      fake.status.value = value
      act(() => fake.statusListeners.forEach((listener) => listener()))
    }

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['account'] })
  })
})
