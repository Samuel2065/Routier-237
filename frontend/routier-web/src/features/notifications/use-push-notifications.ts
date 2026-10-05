import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import type { NotificationSpace } from '@/api/notifications'
import { queryKeys } from '@/lib/query-keys'
import { onForegroundPush, onPushNotificationClick, PUSH_CHANGED_EVENT, pushConfigured, syncPush } from '@/lib/push'

/**
 * Notifications push d'un espace ouvert :
 * - renvoie le jeton de l'appareil à l'API (renouvellement, reconnexion) si ce compte a
 *   activé le push ici — sans jamais demander la permission ;
 * - message reçu onglet au premier plan : relecture du centre (le toast reste unique) ;
 * - clic sur une notification système : ouverture de la page liée dans cet onglet.
 */
export function usePushNotifications(space: NotificationSpace, userId: number) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  // Activation ou désactivation depuis la carte « Notifications sur cet appareil ».
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const refresh = () => setVersion((value) => value + 1)
    window.addEventListener(PUSH_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(PUSH_CHANGED_EVENT, refresh)
  }, [])

  useEffect(() => onPushNotificationClick((link) => navigate(link)), [navigate])

  useEffect(() => {
    if (!pushConfigured) return

    let cancelled = false
    let unsubscribe: (() => void) | undefined

    syncPush(space, userId)
      .then(async (active) => {
        if (!active || cancelled) return
        const stop = await onForegroundPush(() => void queryClient.invalidateQueries({ queryKey: queryKeys.spaceNotificationsAll(space) }))
        if (cancelled) stop()
        else unsubscribe = stop
      })
      // Push indisponible (réseau, Firebase, permission retirée) : le temps réel et
      // l'interrogation de secours continuent d'alimenter le centre de notifications.
      .catch(() => {})

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [space, userId, queryClient, version])
}
