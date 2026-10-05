import { type QueryKey, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getEcho, getRealtimeStatus, subscribeRealtimeStatus } from '@/lib/realtime'

/**
 * Signal reçu du serveur (App\Events\LiveUpdate) : sujets modifiés et identifiants, jamais de données.
 */
export interface LivePayload {
  topics: string[]
  ids: Record<string, number[]>
}

/** Espace d'écoute : privé (client, agence, admin) ou public (places disponibles). */
export type LiveScope = 'customer' | 'agency' | 'admin' | 'public'

/** Requêtes de chaque espace, rechargées après une coupure (signaux possiblement manqués). */
const SCOPE_PREFIXES: Record<LiveScope, QueryKey[]> = {
  customer: [['account']],
  agency: [['agency']],
  admin: [['admin']],
  public: [['trips'], ['trip'], ['public-agency']],
}

/**
 * Requêtes à recharger pour un signal. Seules les requêtes affichées sont réellement
 * relues ; les autres sont simplement marquées périmées.
 */
export function queryKeysFor(scope: LiveScope, payload: LivePayload): QueryKey[] {
  const has = (topic: string) => payload.topics.includes(topic)
  const keys: QueryKey[] = []

  switch (scope) {
    case 'customer':
      if (has('reservations')) keys.push(['account', 'reservations'], ['account', 'reservation'])
      if (has('payments')) keys.push(['account', 'payment'])
      if (has('notifications')) keys.push(['account', 'notifications'])
      break
    case 'agency':
      if (has('reservations')) keys.push(['agency', 'reservations'], ['agency', 'reservation'])
      if (has('trips')) keys.push(['agency', 'trips'])
      if (has('payments')) keys.push(['agency', 'payments'])
      if (has('vehicles')) keys.push(['agency', 'vehicles'])
      if (has('dashboard')) keys.push(['agency', 'dashboard'])
      if (has('notifications')) keys.push(['agency', 'notifications'])
      break
    case 'admin':
      if (has('dashboard')) keys.push(['admin', 'dashboard'])
      break
    case 'public':
      if (has('availability')) {
        keys.push(['trips', 'search'], ['public-agency'])
        const tripIds = payload.ids.trip
        keys.push(...(tripIds?.length ? tripIds.map((id) => ['trip', id]) : [['trip']]))
      }
      break
  }

  return keys
}

/** Regroupe les signaux rapprochés (ex. annulation d'un trajet) en un seul rechargement. */
const BATCH_DELAY_MS = 250

/**
 * Écoute un canal temps réel et recharge les données concernées. Sans canal (null) ou sans
 * temps réel configuré, ne fait rien : l'interrogation de secours prend le relais.
 * Le canal est quitté au démontage (déconnexion, changement d'espace).
 */
export function useLiveUpdates(scope: LiveScope, channel: string | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const echoPromise = channel ? getEcho() : null
    if (!channel || !echoPromise) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const pending = new Map<string, QueryKey>()

    const flush = () => {
      pending.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey }))
      pending.clear()
    }

    const onUpdate = (payload: LivePayload) => {
      for (const queryKey of queryKeysFor(scope, payload)) pending.set(JSON.stringify(queryKey), queryKey)
      clearTimeout(timer)
      timer = setTimeout(flush, BATCH_DELAY_MS)
    }

    void echoPromise.then((echo) => {
      if (cancelled) return
      const subscription = scope === 'public' ? echo.channel(channel) : echo.private(channel)
      subscription.listen('.live.update', onUpdate)
    })

    // Après une coupure, les signaux manqués sont remplacés par un rechargement de l'espace.
    let lostConnection = false
    const stopWatching = subscribeRealtimeStatus(() => {
      const current = getRealtimeStatus()
      if (current === 'unavailable') lostConnection = true
      if (current === 'connected' && lostConnection) {
        lostConnection = false
        SCOPE_PREFIXES[scope].forEach((queryKey) => void queryClient.invalidateQueries({ queryKey }))
      }
    })

    return () => {
      cancelled = true
      clearTimeout(timer)
      stopWatching()
      void echoPromise.then((echo) => echo.leave(channel))
    }
  }, [scope, channel, queryClient])
}

/**
 * Places disponibles (canal public « trips ») : recherche, détail d'un trajet, page d'agence.
 */
export function usePublicAvailabilityUpdates() {
  useLiveUpdates('public', 'trips')
}
