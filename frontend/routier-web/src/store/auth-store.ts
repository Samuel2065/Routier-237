import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { RoleName, Space, User } from '@/types/api'

/**
 * Session de l'utilisateur connecté. Un jeton Sanctum est limité à l'espace par lequel
 * l'utilisateur s'est connecté (client, agence ou administrateur).
 *
 * Une seule session à la fois dans le navigateur : se connecter dans un espace ferme les
 * autres. Sans cela, un client connecté après un employé sur le même poste pouvait ouvrir
 * l'espace agence avec le jeton resté en mémoire.
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

export const AUTH_STORAGE_KEY = 'routier237-auth'

/**
 * Rôles admis dans chaque espace (miroir de AccessSpace::allowedRoles côté API).
 */
export const SPACE_ROLES: Record<Space, readonly RoleName[]> = {
  customer: ['customer'],
  agency: ['director', 'agency_manager', 'counter_clerk', 'accountant', 'driver'],
  admin: ['super_admin'],
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      sessions: {},
      // Remplace toute session existante, quel que soit son espace.
      setSession: (space, session) => set({ sessions: { [space]: session } }),
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
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ sessions: state.sessions }),
      // Version 1 : une seule session. Un ancien stockage contenant plusieurs sessions
      // (version 0) est vidé : impossible de savoir laquelle est la plus récente.
      version: 1,
      migrate: (persisted) => {
        const sessions = (persisted as Partial<AuthState> | undefined)?.sessions ?? {}
        return { sessions: Object.keys(sessions).length === 1 ? sessions : {} }
      },
    },
  ),
)

/**
 * Session utilisable pour un espace : présente, non expirée et dont le rôle correspond à l'espace.
 */
export function isSessionValid(space: Space, session: Session | undefined, now: Date = new Date()): session is Session {
  return (
    !!session &&
    (!session.expiresAt || new Date(session.expiresAt) > now) &&
    session.user.role !== null &&
    SPACE_ROLES[space].includes(session.user.role)
  )
}

/**
 * Session active d'un espace (undefined si absente, expirée ou d'un rôle étranger à l'espace).
 */
export function useSession(space: Space): Session | undefined {
  const session = useAuthStore((state) => state.sessions[space])
  return isSessionValid(space, session) ? session : undefined
}

export function getToken(space: Space): string | undefined {
  const session = useAuthStore.getState().sessions[space]
  return isSessionValid(space, session) ? session.token : undefined
}

/**
 * Identité de la session (jetons par espace) : change à la connexion, à la déconnexion ou au
 * changement de compte, mais pas lors d'une simple mise à jour du profil.
 */
export function sessionIdentity(sessions: AuthState['sessions']): string {
  return (Object.keys(sessions) as Space[])
    .sort()
    .map((space) => `${space}:${sessions[space]?.token ?? ''}`)
    .join('|')
}
