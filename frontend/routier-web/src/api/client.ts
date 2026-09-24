import axios, { type AxiosInstance } from 'axios'
import { getToken, useAuthStore } from '@/store/auth-store'
import type { Space } from '@/types/api'

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')

export const API_BASE_URL = `${API_URL}/api/v1`

/**
 * Client HTTP d'un espace : ajoute le jeton de cet espace et ferme la session
 * locale si l'API la refuse (jeton expiré, révoqué ou compte désactivé).
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
        if (status === 401 || (status === 403 && message === 'Votre accès est désactivé.')) {
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
