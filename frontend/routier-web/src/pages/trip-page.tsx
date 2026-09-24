import { ArrowLeft, Ticket } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Container } from '@/components/layout/container'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useTrip } from '@/features/trips/queries'
import { TripSummary } from '@/features/trips/trip-summary'
import { getErrorMessage, getStatus } from '@/lib/api-error'

/**
 * Détail public d'un trajet publié (/trips/:id).
 */
export function TripPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const trip = useTrip(Number(id))
  const passengers = searchParams.get('passengers')

  return (
    <Container className="grid max-w-3xl gap-6">
      <Button variant="ghost" className="w-fit" onClick={() => navigate(-1)}>
        <ArrowLeft aria-hidden="true" />
        Retour
      </Button>

      {trip.isPending && <LoadingState rows={2} />}
      {trip.isError &&
        (getStatus(trip.error) === 404 ? (
          <EmptyState
            title="Ce trajet n'est pas disponible"
            description="Il a peut-être été annulé ou n'est plus publié."
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
        <Card>
          <CardContent className="grid gap-6">
            <TripSummary trip={trip.data} />
            {trip.data.bookable ? (
              <Button asChild size="lg" className="h-10 w-full sm:w-fit">
                <Link to={`/booking/${trip.data.id}${passengers ? `?passengers=${passengers}` : ''}`}>
                  <Ticket aria-hidden="true" />
                  Réserver ce trajet
                </Link>
              </Button>
            ) : (
              <Alert>
                <AlertDescription>Ce trajet n'est plus réservable (complet ou départ passé).</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </Container>
  )
}
