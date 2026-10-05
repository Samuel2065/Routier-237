import { Bell, CheckCheck, Trash2 } from 'lucide-react'
import { Link } from 'react-router'
import type { NotificationSpace } from '@/api/notifications'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { notificationLink, notificationTitle } from '@/features/notifications/notification-meta'
import {
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/features/notifications/queries'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Centre de notifications d'un espace : historique persistant (lu / non lu, suppression).
 * Fermer un toast ne modifie pas cet historique.
 */
export function NotificationList({ space = 'customer' }: { space?: NotificationSpace }) {
  const notifications = useNotifications(space)
  const markRead = useMarkNotificationRead(space)
  const markAllRead = useMarkAllNotificationsRead(space)
  const remove = useDeleteNotification(space)

  if (notifications.isPending) return <LoadingState rows={2} />
  if (notifications.isError) return <ErrorState onRetry={() => notifications.refetch()} />

  const { data: items, unread_count: unread } = notifications.data

  if (items.length === 0) {
    return <EmptyState icon={<Bell className="size-8 text-muted-foreground" aria-hidden="true" />} title="Aucune notification pour le moment." />
  }

  return (
    <div className="grid gap-3">
      {unread > 0 && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate(undefined)} disabled={markAllRead.isPending}>
            <CheckCheck aria-hidden="true" />
            Tout marquer comme lu
          </Button>
        </div>
      )}
      <ul className="grid gap-2">
        {items.map((notification) => {
          const link = notificationLink(space, notification)

          return (
            <li
              key={notification.id}
              className={cn('flex items-start gap-3 rounded-lg border p-3', !notification.read_at && 'border-primary/30 bg-secondary/50')}
            >
              <Bell className={cn('mt-0.5 size-4 shrink-0', notification.read_at ? 'text-muted-foreground' : 'text-primary')} aria-hidden="true" />
              <div className="grid min-w-0 flex-1 gap-1">
                <p className="text-sm font-medium">
                  {notificationTitle(notification)}
                  {!notification.read_at && <span className="sr-only"> (non lue)</span>}
                </p>
                <p className="text-sm text-muted-foreground">{notification.data.message}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(notification.created_at)}
                  {link && (
                    <>
                      {' · '}
                      <Link
                        to={link}
                        onClick={() => !notification.read_at && markRead.mutate(notification.id)}
                        className="underline underline-offset-4"
                      >
                        {space === 'customer' ? 'Voir la réservation' : 'Ouvrir'}
                      </Link>
                    </>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!notification.read_at && (
                  <Button variant="ghost" size="xs" onClick={() => markRead.mutate(notification.id)} aria-label="Marquer comme lue">
                    Lu
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => remove.mutate(notification.id)}
                  disabled={remove.isPending && remove.variables === notification.id}
                  aria-label="Supprimer la notification"
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
