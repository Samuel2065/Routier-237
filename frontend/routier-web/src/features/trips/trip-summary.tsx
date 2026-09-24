import { Building2, CalendarDays, Clock, MapPin, Route, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatDuration, formatPrice, formatTime } from '@/lib/format'
import type { PublicTrip } from '@/types/api'

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="grid gap-0.5">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm font-medium">{children}</dd>
      </div>
    </div>
  )
}

/**
 * Informations détaillées et récapitulatif tarifaire d'un trajet (§5.2, étape 2).
 */
export function TripSummary({ trip }: { trip: PublicTrip }) {
  const duration = formatDuration(trip.estimated_duration_minutes)

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold">
          {trip.departure_city.name} → {trip.destination_city.name}
        </h2>
        <Badge variant="secondary">{trip.travel_class.name}</Badge>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <Row icon={<CalendarDays className="size-4" aria-hidden="true" />} label="Date">
          {formatDate(trip.departure_date)}
        </Row>
        <Row icon={<Clock className="size-4" aria-hidden="true" />} label="Horaire">
          Départ {trip.departure_time}
          {trip.estimated_arrival_at && ` · arrivée estimée vers ${formatTime(trip.estimated_arrival_at)}`}
        </Row>
        <Row icon={<Building2 className="size-4" aria-hidden="true" />} label="Agence">
          <Link to={`/agencies/${trip.agency.id}`} className="underline underline-offset-4">
            {trip.agency.name}
          </Link>
        </Row>
        <Row icon={<MapPin className="size-4" aria-hidden="true" />} label="Départ depuis">
          {trip.agency.city.name}
        </Row>
        {(duration || trip.distance_km) && (
          <Row icon={<Route className="size-4" aria-hidden="true" />} label="Trajet">
            {[duration && `${duration} (estimation)`, trip.distance_km && `${trip.distance_km} km`].filter(Boolean).join(' · ')}
          </Row>
        )}
        <Row icon={<Users className="size-4" aria-hidden="true" />} label="Places restantes">
          {trip.remaining_seats}
        </Row>
      </dl>

      {trip.travel_class.description && <p className="text-sm text-muted-foreground">{trip.travel_class.description}</p>}

      {trip.vehicle && (
        <div className="grid gap-2 rounded-lg bg-muted/50 p-3 text-sm">
          <p>
            <span className="text-muted-foreground">Véhicule : </span>
            {trip.vehicle.brand} {trip.vehicle.model} ({trip.vehicle.capacity} places)
          </p>
          {trip.vehicle.amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {trip.vehicle.amenities.map((amenity) => (
                <Badge key={amenity} variant="outline">
                  {amenity}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-2xl font-semibold">
        {formatPrice(trip.price)} <span className="text-sm font-normal text-muted-foreground">par passager</span>
      </p>
    </div>
  )
}
