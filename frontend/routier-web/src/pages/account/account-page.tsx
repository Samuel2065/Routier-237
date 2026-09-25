import { ArrowRight, Mail, Phone, Search, Ticket, type LucideIcon } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { UserAvatar } from '@/components/common/user-avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NotificationList } from '@/features/notifications/notification-list'
import { useMyReservations } from '@/features/reservations/queries'
import { ReservationCard } from '@/features/reservations/reservation-card'
import { firstName } from '@/lib/format'
import { useSession } from '@/store/auth-store'

function QuickAction({ to, icon: Icon, title, text }: { to: string; icon: LucideIcon; title: string; text: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-xl border bg-card p-5 shadow-card transition-shadow outline-none hover:shadow-card-hover focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted-foreground">{text}</span>
      </span>
      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  )
}

/**
 * Tableau de bord du client (/account).
 */
export function AccountPage() {
  const session = useSession('customer')
  const upcoming = useMyReservations({ page: 1 })
  const { hash } = useLocation()

  // La cloche de notifications mène à /account#notifications.
  useEffect(() => {
    if (hash === '#notifications') document.getElementById('notifications')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash])

  if (!session) return null
  const { user } = session

  return (
    <div className="grid gap-6">
      <PageHeader
        title={`Bonjour, ${firstName(user.name)}`}
        description="Retrouvez vos réservations, vos paiements et vos notifications."
        actions={
          <Button size="lg" asChild>
            <Link to="/">
              <Search aria-hidden="true" />
              Nouveau trajet
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <QuickAction to="/" icon={Search} title="Rechercher un trajet" text="Comparez les départs, classes et prix des agences." />
        <QuickAction to="/account/reservations" icon={Ticket} title="Mes réservations" text="Statut, paiement et détail de chaque voyage." />
      </div>

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
              <CardTitle>Mon compte</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm">
              <div className="flex items-center gap-3">
                <UserAvatar name={user.name} src={user.avatar_url} className="size-12 text-sm" />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{user.name}</p>
                  <p className="text-xs text-muted-foreground">Compte voyageur</p>
                </div>
              </div>
              <div className="grid gap-2">
                <p className="inline-flex min-w-0 items-center gap-2">
                  <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate">{user.email}</span>
                </p>
                {user.phone && (
                  <p className="inline-flex items-center gap-2">
                    <Phone className="size-4 text-muted-foreground" aria-hidden="true" />
                    {user.phone}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <section id="notifications" aria-labelledby="notifications-title" className="grid scroll-mt-20 gap-3">
            <h2 id="notifications-title" className="text-lg font-semibold">
              Notifications
            </h2>
            <NotificationList />
          </section>
        </div>
      </div>
    </div>
  )
}
