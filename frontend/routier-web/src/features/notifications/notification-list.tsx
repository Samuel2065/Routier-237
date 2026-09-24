import { Bell, CheckCheck } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/features/notifications/queries'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Notifications applicatives du client (réservation confirmée, annulée, paiement échoué).
 */
export function NotificationList() {
  const notifications = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

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
          <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
            <CheckCheck aria-hidden="true" />
            Tout marquer comme lu
          </Button>
        </div>
      )}
      <ul className="grid gap-2">
        {items.map((notification) => (
          <li
            key={notification.id}
            className={cn('flex items-start gap-3 rounded-lg border p-3', !notification.read_at && 'border-primary/30 bg-secondary/50')}
          >
            <Bell className={cn('mt-0.5 size-4 shrink-0', notification.read_at ? 'text-muted-foreground' : 'text-primary')} aria-hidden="true" />
            <div className="grid flex-1 gap-1">
              <p className="text-sm">{notification.data.message}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(notification.created_at)}
                {notification.data.reservation_id && (
                  <>
                    {' · '}
                    <Link to={`/account/reservations/${notification.data.reservation_id}`} className="underline underline-offset-4">
                      Voir la réservation
                    </Link>
                  </>
                )}
              </p>
            </div>
            {!notification.read_at && (
              <Button variant="ghost" size="xs" onClick={() => markRead.mutate(notification.id)} aria-label="Marquer comme lue">
                Lu
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
