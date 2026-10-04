import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { watchSession } from '@/lib/session-watch'
import { AUTH_STORAGE_KEY, type Session, useAuthStore } from '@/store/auth-store'
import type { RoleName } from '@/types/api'

function session(role: RoleName, token: string): Session {
  return {
    token,
    expiresAt: '2099-01-01T00:00:00Z',
    user: {
      id: 1,
      name: 'Test',
      email: 'test@routier237.test',
      phone: null,
      avatar_url: null,
      status: 'active',
      role,
      permissions: [],
      organization: null,
      agency: null,
      created_at: '2026-01-01T00:00:00Z',
    },
  }
}

describe('watchSession', () => {
  let queryClient: QueryClient
  let stop: () => void

  beforeEach(() => {
    useAuthStore.setState({ sessions: { agency: session('agency_manager', '1|manager') } })
    queryClient = new QueryClient()
    queryClient.setQueryData(['agency', 'dashboard', null], { departures: 3 })
    queryClient.setQueryData(['cities'], [])
    stop = watchSession(queryClient)
  })

  afterEach(() => stop())

  it('clears every cached query when another account signs in', () => {
    useAuthStore.getState().setSession('customer', session('customer', '2|client'))

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })

  it('clears every cached query on sign-out', () => {
    useAuthStore.getState().clearSession('agency')

    expect(queryClient.getQueryData(['agency', 'dashboard', null])).toBeUndefined()
  })

  it('keeps the cache when only the profile of the same session is refreshed', () => {
    useAuthStore.getState().setUser('agency', { ...session('agency_manager', '1|manager').user, name: 'Nouveau nom' })

    expect(queryClient.getQueryData(['agency', 'dashboard', null])).toEqual({ departures: 3 })
  })

  it('applies a sign-out made in another tab', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ state: { sessions: {} }, version: 1 }))
    window.dispatchEvent(new StorageEvent('storage', { key: AUTH_STORAGE_KEY }))

    await vi.waitFor(() => expect(useAuthStore.getState().sessions).toEqual({}))
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })
})
