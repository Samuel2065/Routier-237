import { LogIn, UserPlus } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Container } from '@/components/layout/container'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BookingForm } from '@/features/reservations/booking-form'
import { useTrip } from '@/features/trips/queries'
import { TripSummary } from '@/features/trips/trip-summary'
import { getErrorMessage, getStatus } from '@/lib/api-error'
import { useSession } from '@/store/auth-store'

/**
 * Parcours de réservation (/booking/:id, §5.2) : récapitulatif, authentification
 * uniquement à cette étape (§4.1), passagers, puis paiement sur la page de la réservation.
 */
export function BookingPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const session = useSession('customer')
  const trip = useTrip(Number(id))
  const redirect = encodeURIComponent(`${location.pathname}${location.search}`)

  return (
    <Container className="grid max-w-3xl gap-6">
      <PageHeader title="Réservation" description="Vérifiez le trajet, indiquez les passagers puis payez." />

      {trip.isPending && <LoadingState rows={2} />}
      {trip.isError &&
        (getStatus(trip.error) === 404 ? (
          <EmptyState
            title="Ce trajet n'est pas disponible"
            action={
              <Button asChild>
                <Link to="/">Nouvelle recherche</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState message={getErrorMessage(trip.error)} onRetry={() => trip.refetch()} />
        ))}

      {trip.data && (
        <>
          <Card>
            <CardContent>
              <TripSummary trip={trip.data} />
            </CardContent>
          </Card>

          {!trip.data.bookable ? (
            <Alert>
              <AlertDescription>
                Ce trajet n'est plus réservable (complet ou départ passé).{' '}
                <Link to="/" className="underline">
                  Faire une nouvelle recherche
                </Link>
              </AlertDescription>
            </Alert>
          ) : !session ? (
            <Card>
              <CardHeader>
                <CardTitle>Connectez-vous pour réserver</CardTitle>
                <CardDescription>Un compte client permet de retrouver vos réservations et leurs paiements.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link to={`/login?redirect=${redirect}`}>
                    <LogIn aria-hidden="true" />
                    Se connecter
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to={`/register?redirect=${redirect}`}>
                    <UserPlus aria-hidden="true" />
                    Créer un compte
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <section aria-labelledby="passengers-title" className="grid gap-4">
              <h2 id="passengers-title" className="text-lg font-semibold">
                Passagers
              </h2>
              <BookingForm
                trip={trip.data}
                customer={session.user}
                initialPassengers={Number(searchParams.get('passengers') ?? 1)}
                onBooked={(reservation) => {
                  toast.success(`Réservation ${reservation.reference} créée : procédez au paiement.`)
                  navigate(`/account/reservations/${reservation.id}`, { replace: true })
                }}
              />
            </section>
          )}
        </>
      )}
    </Container>
  )
}
