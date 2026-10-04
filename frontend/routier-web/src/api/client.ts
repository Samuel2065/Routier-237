import axios, { type AxiosInstance } from 'axios'
import { getToken, useAuthStore } from '@/store/auth-store'
import type { Space } from '@/types/api'

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')

export const API_BASE_URL = `${API_URL}/api/v1`

/** Autorisation des canaux temps réel privés (Laravel Broadcasting, hors version de l'API). */
export const BROADCAST_AUTH_URL = `${API_URL}/api/broadcasting/auth`

/**
 * Refus de l'API qui invalident la session locale : jeton absent, expiré ou révoqué (401),
 * compte désactivé, ou jeton émis pour un autre espace (403 du middleware « space »).
 * Les autres 403 (permission manquante pour une action) laissent la session ouverte.
 */
export const SESSION_ENDING_403_MESSAGES = ['Votre accès est désactivé.', 'Accès non autorisé depuis cet espace.']

export function endsSession(status: number | undefined, message: string | undefined): boolean {
  return status === 401 || (status === 403 && !!message && SESSION_ENDING_403_MESSAGES.includes(message))
}

/**
 * Client HTTP d'un espace : ajoute le jeton de cet espace et ferme la session
 * locale si l'API la refuse (voir endsSession).
 */
function createApiClient(space?: Space): AxiosInstance {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    headers: { Accept: 'application/json' },
    timeout: 20_000,
  })

  if (space) {
    instance.interceptors.request.use((config) => {
      const token = getToken(space)
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    })

    instance.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error?.response?.status
        const message: string | undefined = error?.response?.data?.message
        if (endsSession(status, message)) {
          useAuthStore.getState().clearSession(space)
        }
        return Promise.reject(error)
      },
    )
  }

  return instance
}

/** Endpoints publics, sans jeton. */
export const publicApi = createApiClient()

/** Espace client (/account/*, /auth/me, /auth/logout avec le jeton client). */
export const customerApi = createApiClient('customer')

/** Espace agence (/agency/*, /auth/me, /auth/logout avec le jeton agence). */
export const agencyApi = createApiClient('agency')

/** Espace administrateur (/admin/*, /auth/me, /auth/logout avec le jeton admin). */
export const adminApi = createApiClient('admin')
