import { beforeEach, describe, expect, it } from 'vitest'
import { AUTH_STORAGE_KEY, getToken, isSessionValid, type Session, sessionIdentity, useAuthStore } from '@/store/auth-store'
import type { RoleName } from '@/types/api'

function session(role: RoleName, token = `1|${role}`, expiresAt: string | null = '2099-01-01T00:00:00Z'): Session {
  return {
    token,
    expiresAt,
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

describe('auth store', () => {
  beforeEach(() => useAuthStore.setState({ sessions: {} }))

  it('keeps a single session: signing in to a space closes the others', () => {
    useAuthStore.getState().setSession('agency', session('agency_manager'))
    useAuthStore.getState().setSession('customer', session('customer'))

    expect(useAuthStore.getState().sessions).toEqual({ customer: session('customer') })
    expect(getToken('agency')).toBeUndefined()
    expect(getToken('customer')).toBe('1|customer')
  })

  it('only accepts a session whose role belongs to the space', () => {
    expect(isSessionValid('agency', session('agency_manager'))).toBe(true)
    expect(isSessionValid('agency', session('director'))).toBe(true)
    expect(isSessionValid('agency', session('customer'))).toBe(false)
    expect(isSessionValid('agency', session('super_admin'))).toBe(false)
    expect(isSessionValid('admin', session('director'))).toBe(false)
    expect(isSessionValid('customer', session('counter_clerk'))).toBe(false)

    // Une session altérée dans le stockage local ne fournit pas de jeton.
    useAuthStore.setState({ sessions: { agency: session('customer') } })
    expect(getToken('agency')).toBeUndefined()
  })

  it('rejects an expired session', () => {
    expect(isSessionValid('customer', session('customer', '1|old', '2020-01-01T00:00:00Z'))).toBe(false)
    expect(isSessionValid('customer', undefined)).toBe(false)
  })

  it('drops a legacy storage that held several sessions at once', async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ state: { sessions: { agency: session('agency_manager'), customer: session('customer') } }, version: 0 }),
    )
    await useAuthStore.persist.rehydrate()
    expect(useAuthStore.getState().sessions).toEqual({})

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ state: { sessions: { customer: session('customer') } }, version: 0 }))
    await useAuthStore.persist.rehydrate()
    expect(useAuthStore.getState().sessions).toEqual({ customer: session('customer') })
  })

  it('identifies the session by its tokens, not by the profile', () => {
    const before = sessionIdentity({ agency: session('agency_manager') })
    const renamed = session('agency_manager')
    renamed.user.name = 'Nouveau nom'

    expect(sessionIdentity({ agency: renamed })).toBe(before)
    expect(sessionIdentity({ agency: session('agency_manager', '2|other') })).not.toBe(before)
    expect(sessionIdentity({})).not.toBe(before)
  })
})
