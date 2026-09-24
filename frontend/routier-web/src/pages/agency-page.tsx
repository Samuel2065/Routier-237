import { Building2, Mail, MapPin, Phone } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { Container } from '@/components/layout/container'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAgency, useAgencyTrips } from '@/features/agencies/queries'
import { TripCard } from '@/features/trips/trip-card'
import { getErrorMessage, getStatus } from '@/lib/api-error'
import { formatDate } from '@/lib/format'
import type { PublicTrip } from '@/types/api'

/**
 * Profil public d'une agence et ses trajets publiés (/agencies/:id).
 */
export function AgencyPage() {
  const { id } = useParams()
  const agencyId = Number(id)
  const agency = useAgency(agencyId)
  const trips = useAgencyTrips(agencyId)

  if (agency.isPending) {
    return (
      <Container>
        <LoadingState rows={3} />
      </Container>
    )
  }

  if (agency.isError) {
    return (
      <Container>
        {getStatus(agency.error) === 404 ? (
          <EmptyState
            title="Agence introuvable"
            action={
              <Button asChild>
                <Link to="/">Retour à l'accueil</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState message={getErrorMessage(agency.error)} onRetry={() => agency.refetch()} />
        )}
      </Container>
    )
  }

  const data = agency.data
  const allTrips = trips.data?.pages.flatMap((page) => page.data) ?? []
  const byDate = allTrips.reduce<Record<string, PublicTrip[]>>((groups, trip) => {
    ;(groups[trip.departure_date] ??= []).push(trip)
    return groups
  }, {})

  return (
    <Container className="grid gap-8">
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
            <Building2 className="size-7" aria-hidden="true" />
          </span>
          <div className="grid gap-2">
            <h1 className="text-2xl font-semibold">{data.name}</h1>
            {data.organization && <p className="text-muted-foreground">{data.organization.name}</p>}
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              {data.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-4" aria-hidden="true" />
                  {[data.address, data.city.name].filter(Boolean).join(', ')}
                </span>
              )}
              {data.phone && (
                <a href={`tel:${data.phone}`} className="inline-flex items-center gap-1 hover:underline">
                  <Phone className="size-4" aria-hidden="true" />
                  {data.phone}
                </a>
              )}
              {data.email && (
                <a href={`mailto:${data.email}`} className="inline-flex items-center gap-1 hover:underline">
                  <Mail className="size-4" aria-hidden="true" />
                  {data.email}
                </a>
              )}
            </div>
            {data.description && <p className="text-sm">{data.description}</p>}
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="agency-trips" className="grid gap-4">
        <h2 id="agency-trips" className="text-xl font-semibold">
          Prochains départs
        </h2>

        {trips.isPending && <LoadingState rows={3} />}
        {trips.isError && <ErrorState message={getErrorMessage(trips.error)} onRetry={() => trips.refetch()} />}
        {trips.data && allTrips.length === 0 && <EmptyState title="Aucun départ publié pour le moment." />}

        {Object.entries(byDate).map(([date, dayTrips]) => (
          <div key={date} className="grid gap-3">
            <h3 className="text-sm font-medium text-muted-foreground capitalize">{formatDate(date)}</h3>
            <ul className="grid gap-3">
              {dayTrips.map((trip) => (
                <li key={trip.id}>
                  <TripCard trip={trip} />
                </li>
              ))}
            </ul>
          </div>
        ))}

        {trips.hasNextPage && (
          <Button variant="outline" className="w-fit justify-self-center" onClick={() => trips.fetchNextPage()} disabled={trips.isFetchingNextPage}>
            {trips.isFetchingNextPage ? 'Chargement…' : 'Voir plus de départs'}
          </Button>
        )}
      </section>
    </Container>
  )
}
