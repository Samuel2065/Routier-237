import { PageHeader } from '@/components/common/page-header'
import { NotificationList } from '@/features/notifications/notification-list'
import { PushNotificationsCard } from '@/features/notifications/push-notifications-card'
import { useSession } from '@/store/auth-store'

/**
 * Centre de notifications du personnel (/agency/notifications) : alertes de son agence
 * selon ses permissions (nouvelles réservations, annulations, remboursements à effectuer).
 */
export function AgencyNotificationsPage() {
  const session = useSession('agency')

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Notifications"
        description="Alertes de votre agence. Elles restent ici, lues ou non, jusqu'à ce que vous les supprimiez."
      />
      <div className="grid max-w-3xl gap-4">
        {session && <PushNotificationsCard space="agency" userId={session.user.id} />}
        <NotificationList space="agency" />
      </div>
    </div>
  )
}
