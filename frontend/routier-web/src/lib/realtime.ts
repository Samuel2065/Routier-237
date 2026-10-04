import type Echo from 'laravel-echo'
import type { ChannelAuthorizationCallback } from 'pusher-js'
import { useSyncExternalStore } from 'react'
import { adminApi, agencyApi, BROADCAST_AUTH_URL, customerApi } from '@/api/client'
import type { Space } from '@/types/api'

/** Réponse de POST /api/broadcasting/auth (signature du canal privé). */
type ChannelAuthorizationData = NonNullable<Parameters<ChannelAuthorizationCallback>[1]>

/**
 * Connexion temps réel au serveur Laravel Reverb (via Laravel Echo).
 *
 * Le serveur n'envoie que des signaux « ces données ont changé » ; les écrans relisent
 * ensuite les données par l'API habituelle. Sans configuration (VITE_REVERB_APP_KEY vide)
 * ou si le serveur est injoignable, l'application se rabat sur l'interrogation régulière.
 *
 * Les bibliothèques ne sont chargées qu'à la première utilisation (bundle initial inchangé).
 * La clé Reverb est publique ; le secret reste exclusivement côté serveur.
 */

export type RealtimeStatus = 'disabled' | 'connecting' | 'connected' | 'unavailable'

const REVERB_KEY = import.meta.env.VITE_REVERB_APP_KEY as string | undefined
const REVERB_HOST = (import.meta.env.VITE_REVERB_HOST as string | undefined) || 'localhost'
const REVERB_PORT = Number(import.meta.env.VITE_REVERB_PORT || 8080)
const REVERB_SCHEME = (import.meta.env.VITE_REVERB_SCHEME as string | undefined) || 'http'

export const realtimeEnabled = !!REVERB_KEY

/**
 * Espace dont le jeton autorise un canal privé (mêmes règles que routes/channels.php).
 */
export function spaceForChannel(channelName: string): Space | null {
  const name = channelName.replace(/^private-/, '')
  if (name.startsWith('agency.') || name.startsWith('organization.')) return 'agency'
  if (name.startsWith('user.')) return 'customer'
  if (name === 'admin') return 'admin'
  return null
}

const apiBySpace = { customer: customerApi, agency: agencyApi, admin: adminApi }

/* État de la connexion (pour choisir entre temps réel et interrogation de secours) ---- */

let status: RealtimeStatus = realtimeEnabled ? 'connecting' : 'disabled'
const statusListeners = new Set<() => void>()

function setStatus(next: RealtimeStatus) {
  if (next === status) return
  status = next
  statusListeners.forEach((listener) => listener())
}

export function getRealtimeStatus(): RealtimeStatus {
  return status
}

export function subscribeRealtimeStatus(listener: () => void): () => void {
  statusListeners.add(listener)
  return () => statusListeners.delete(listener)
}

export function useRealtimeStatus(): RealtimeStatus {
  return useSyncExternalStore(subscribeRealtimeStatus, getRealtimeStatus)
}

/** Interrogation de secours des écrans suivis quand le temps réel n'est pas connecté. */
export const FALLBACK_POLL_MS = 60_000

/**
 * Intervalle d'interrogation de secours : désactivé tant que le temps réel est connecté.
 * TanStack Query n'interroge de toute façon pas un onglet masqué.
 */
export function useLiveFallbackInterval(ms: number = FALLBACK_POLL_MS): number | false {
  return useRealtimeStatus() === 'connected' ? false : ms
}

/* Connexion unique, créée à la demande ------------------------------------------------ */

let echoPromise: Promise<Echo<'reverb'>> | null = null

export function getEcho(): Promise<Echo<'reverb'>> | null {
  if (!realtimeEnabled) return null

  echoPromise ??= Promise.all([import('laravel-echo'), import('pusher-js')]).then(([{ default: EchoClient }, { default: Pusher }]) => {
    const echo = new EchoClient({
      broadcaster: 'reverb',
      key: REVERB_KEY as string,
      wsHost: REVERB_HOST,
      wsPort: REVERB_PORT,
      wssPort: REVERB_PORT,
      forceTLS: REVERB_SCHEME === 'https',
      enabledTransports: ['ws', 'wss'],
      Pusher,
      withoutInterceptors: true,
      // Autorisation d'un canal privé avec le jeton Bearer de l'espace concerné (client HTTP de
      // l'espace : un refus 401/403 y ferme la session comme pour tout appel d'API).
      channelAuthorization: {
        transport: 'ajax',
        endpoint: BROADCAST_AUTH_URL,
        customHandler: ({ socketId, channelName }, callback) => {
          const space = spaceForChannel(channelName)
          if (!space) {
            callback(new Error(`Canal inconnu : ${channelName}`), null)
            return
          }
          apiBySpace[space]
            .post<ChannelAuthorizationData>(BROADCAST_AUTH_URL, { socket_id: socketId, channel_name: channelName })
            .then(({ data }) => callback(null, data))
            .catch((error: Error) => callback(error, null))
        },
      },
    })

    echo.connector.pusher.connection.bind('state_change', ({ current }: { current: string }) => {
      setStatus(current === 'connected' ? 'connected' : current === 'connecting' || current === 'initialized' ? 'connecting' : 'unavailable')
    })

    return echo
  })

  return echoPromise
}
