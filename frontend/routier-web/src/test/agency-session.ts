import { useAuthStore } from '@/store/auth-store'
import type { RoleName, User } from '@/types/api'

/**
 * Ouvre une session d'espace agence pour les tests (rôle et permissions donnés).
 */
export function signInAgency(role: RoleName, permissions: string[], overrides: Partial<User> = {}) {
  useAuthStore.setState({
    sessions: {
      agency: {
        token: '1|test',
        expiresAt: '2099-01-01T00:00:00Z',
        user: {
          id: 1,
          name: 'Agent Test',
          email: 'agent@routier237.test',
          phone: null,
          avatar_url: null,
          status: 'active',
          role,
          permissions,
          assignable_roles: [],
          organization: { id: 1, name: 'Routier Démo Voyages' },
          agency: { id: 1, name: 'Agence Bertoua Centre' },
          created_at: '2026-01-01T00:00:00Z',
          ...overrides,
        },
      },
    },
  })
}
