import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { ReservationStatusBadge } from '@/components/common/status-badges'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate, formatPrice, pluralize } from '@/lib/format'
import type { Reservation } from '@/types/api'

export function ReservationCard({ reservation }: { reservation: Reservation }) {
  const trip = reservation.trip

  return (
    <Link to={`/account/reservations/${reservation.id}`} className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-ring">
      <Card className="transition-shadow group-hover:shadow-md">
        <CardContent className="flex items-center gap-4">
          <div className="grid flex-1 gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-medium">{reservation.reference}</span>
              <ReservationStatusBadge status={reservation.status} />
            </div>
            {trip && (
              <>
                <p className="font-medium">
                  {trip.departure_city.name} → {trip.destination_city.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(trip.departure_date)} à {trip.departure_time} · {trip.agency.name} · {trip.travel_class.name}
                </p>
              </>
            )}
            <p className="text-sm text-muted-foreground">
              {pluralize(reservation.passenger_count, 'passager')} · {formatPrice(reservation.total_amount)}
            </p>
          </div>
          <ChevronRight className="size-5 text-muted-foreground" aria-hidden="true" />
        </CardContent>
      </Card>
    </Link>
  )
}
