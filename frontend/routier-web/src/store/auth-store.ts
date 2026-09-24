import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Space, User } from '@/types/api'

/**
 * Sessions par espace (client, agence, administrateur) : un jeton Sanctum est
 * limité à l'espace par lequel l'utilisateur s'est connecté.
 *
 * Le jeton est conservé dans le stockage local du navigateur (API et frontend
 * déployés séparément) : aucune donnée non maîtrisée ne doit être injectée en HTML.
 * Ce store sert l'affichage ; l'API reste seule juge des droits.
 */
export interface Session {
  token: string
  expiresAt: string | null
  user: User
}

interface AuthState {
  sessions: Partial<Record<Space, Session>>
  setSession: (space: Space, session: Session) => void
  setUser: (space: Space, user: User) => void
  clearSession: (space: Space) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      sessions: {},
      setSession: (space, session) =>
        set((state) => ({ sessions: { ...state.sessions, [space]: session } })),
      setUser: (space, user) =>
        set((state) => {
          const current = state.sessions[space]
          return current ? { sessions: { ...state.sessions, [space]: { ...current, user } } } : state
        }),
      clearSession: (space) =>
        set((state) => {
          const sessions = { ...state.sessions }
          delete sessions[space]
          return { sessions }
        }),
    }),
    {
      name: 'routier237-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ sessions: state.sessions }),
    },
  ),
)

export function isSessionValid(session: Session | undefined, now: Date = new Date()): session is Session {
  return !!session && (!session.expiresAt || new Date(session.expiresAt) > now)
}

/**
 * Session active d'un espace (undefined si absente ou expirée).
 */
export function useSession(space: Space): Session | undefined {
  const session = useAuthStore((state) => state.sessions[space])
  return isSessionValid(session) ? session : undefined
}

export function getToken(space: Space): string | undefined {
  const session = useAuthStore.getState().sessions[space]
  return isSessionValid(session) ? session.token : undefined
}
