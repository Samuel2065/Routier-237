import { Bell } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { toast } from '@/lib/toast'
import type { NotificationSpace } from '@/api/notifications'
import { freshNotifications, notificationLink, notificationTitle, wasAnnounced } from '@/features/notifications/notification-meta'
import { useMarkNotificationRead, useNotifications } from '@/features/notifications/queries'
import { usePushNotifications } from '@/features/notifications/use-push-notifications'
import { useLiveUpdates } from '@/features/realtime/live-updates'

/**
 * Notifications en direct d'un espace : écoute du canal personnel du compte et toasts
 * automatiques (sans clic sur la cloche). À monter une seule fois par mise en page.
 */
export function NotificationToasts({ space, userId }: { space: NotificationSpace; userId: number }) {
  const notifications = useNotifications(space)
  const { mutate: markRead } = useMarkNotificationRead(space)
  const navigate = useNavigate()
  const seen = useRef<Set<string> | null>(null)

  // Canal personnel : chaque nouvelle notification relance la lecture du centre.
  useLiveUpdates(space === 'customer' ? 'customer' : 'agency', `user.${userId}`)

  // Notifications push (Firebase), si ce compte les a activées sur cet appareil.
  usePushNotifications(space, userId)

  useEffect(() => {
    const items = notifications.data?.data
    if (!items) return

    const result = freshNotifications(items, seen.current)
    seen.current = result.seen

    for (const notification of result.fresh) {
      // Déjà annoncé par l'écran de l'action : un seul toast, la notification passe en lue.
      if (wasAnnounced(notification)) {
        markRead(notification.id)
        continue
      }

      const link = notificationLink(space, notification)

      toast(notificationTitle(notification), {
        // Même identifiant = même toast : jamais de doublon pour une notification.
        id: `notification-${notification.id}`,
        description: notification.data.message,
        icon: <Bell aria-hidden="true" />,
        action: link
          ? {
              label: 'Voir',
              onClick: () => {
                markRead(notification.id)
                navigate(link)
              },
            }
          : undefined,
      })
    }
  }, [notifications.data, space, markRead, navigate])

  return null
}
