import { Mail, Phone, Search, Ticket } from 'lucide-react'
import { Link } from 'react-router'
import { Container } from '@/components/layout/container'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NotificationList } from '@/features/notifications/notification-list'
import { useMyReservations } from '@/features/reservations/queries'
import { ReservationCard } from '@/features/reservations/reservation-card'
import { useSession } from '@/store/auth-store'

/**
 * Espace personnel du client (/account).
 */
export function AccountPage() {
  const session = useSession('customer')
  const upcoming = useMyReservations({ page: 1 })

  if (!session) return null
  const { user } = session

  return (
    <Container className="grid gap-6">
      <PageHeader
        title={`Bonjour ${user.name}`}
        actions={
          <Button asChild>
            <Link to="/">
              <Search aria-hidden="true" />
              Nouveau trajet
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="recent-reservations" className="grid content-start gap-4">
          <div className="flex items-center justify-between">
            <h2 id="recent-reservations" className="text-lg font-semibold">
              Mes dernières réservations
            </h2>
            <Button variant="link" asChild>
              <Link to="/account/reservations">Tout voir</Link>
            </Button>
          </div>
          {upcoming.isPending && <LoadingState rows={2} />}
          {upcoming.isError && <ErrorState onRetry={() => upcoming.refetch()} />}
          {upcoming.data && upcoming.data.data.length === 0 && (
            <EmptyState
              icon={<Ticket className="size-8 text-muted-foreground" aria-hidden="true" />}
              title="Aucune réservation pour le moment"
              action={
                <Button asChild>
                  <Link to="/">Rechercher un trajet</Link>
                </Button>
              }
            />
          )}
          {upcoming.data?.data.slice(0, 3).map((reservation) => (
            <ReservationCard key={reservation.id} reservation={reservation} />
          ))}
        </section>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Mon profil</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <p className="inline-flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground" aria-hidden="true" />
                {user.email}
              </p>
              {user.phone && (
                <p className="inline-flex items-center gap-2">
                  <Phone className="size-4 text-muted-foreground" aria-hidden="true" />
                  {user.phone}
                </p>
              )}
            </CardContent>
          </Card>

          <section aria-labelledby="notifications-title" className="grid gap-3">
            <h2 id="notifications-title" className="text-lg font-semibold">
              Notifications
            </h2>
            <NotificationList />
          </section>
        </div>
      </div>
    </Container>
  )
}
