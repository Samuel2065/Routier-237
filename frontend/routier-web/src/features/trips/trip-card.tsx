import { ArrowRight, Clock, Users } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDuration, formatPrice, formatTime } from '@/lib/format'
import type { PublicTrip } from '@/types/api'

/**
 * Résultat de recherche : données observables uniquement, sans classement
 * subjectif (§18.3) — heure, trajet, agence, classe, places, prix.
 */
export function TripCard({ trip, passengers = 1 }: { trip: PublicTrip; passengers?: number }) {
  const duration = formatDuration(trip.estimated_duration_minutes)
  const fewSeats = trip.remaining_seats <= 5

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-2xl font-semibold tabular-nums">{trip.departure_time}</span>
            <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-lg tabular-nums text-muted-foreground">
              {trip.estimated_arrival_at ? `~${formatTime(trip.estimated_arrival_at)}` : '—'}
            </span>
            <Badge variant="secondary">{trip.travel_class.name}</Badge>
          </div>

          <p className="font-medium">
            {trip.departure_city.name} → {trip.destination_city.name}
          </p>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <Link to={`/agencies/${trip.agency.id}`} className="font-medium text-foreground underline-offset-4 hover:underline">
              {trip.agency.name}
            </Link>
            {duration && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden="true" />
                {duration} (estimation)
              </span>
            )}
            <span className={`inline-flex items-center gap-1 ${fewSeats ? 'font-medium text-amber-700' : ''}`}>
              <Users className="size-3.5" aria-hidden="true" />
              {trip.remaining_seats} place{trip.remaining_seats > 1 ? 's' : ''} restante{trip.remaining_seats > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t pt-3 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0">
          <div className="text-right">
            <p className="text-xl font-semibold">{formatPrice(trip.price)}</p>
            <p className="text-xs text-muted-foreground">par passager</p>
          </div>
          <Button asChild>
            <Link to={`/trips/${trip.id}?passengers=${passengers}`} aria-label={`Voir le trajet de ${trip.departure_time} avec ${trip.agency.name}`}>
              Choisir
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
