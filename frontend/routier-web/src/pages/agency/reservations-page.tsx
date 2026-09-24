import { Ticket, X } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/common/page-header'
import { Pagination } from '@/components/common/pagination'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { ReservationStatusBadge } from '@/components/common/status-badges'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAgencyReservations } from '@/features/agency/queries'
import { ReservationSheet } from '@/features/agency/reservations/reservation-sheet'
import { useDebouncedCallback } from '@/hooks/use-debounced-callback'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { getErrorMessage } from '@/lib/api-error'
import { formatDate, formatPrice } from '@/lib/format'
import { RESERVATION_STATUS_LABELS } from '@/lib/labels'
import type { ReservationStatus } from '@/types/api'

const ALL = 'all'
const STATUSES: ReservationStatus[] = ['pending', 'confirmed', 'cancelled', 'expired']

/**
 * Réservations des trajets de l'agence (/agency/reservations) : recherche par référence au guichet.
 */
export function AgencyReservationsPage() {
  const filters = useUrlFilters()
  const status = STATUSES.find((value) => value === filters.get('status'))
  const tripId = filters.getNumber('trip_id')
  const reservations = useAgencyReservations({
    status,
    trip_id: tripId,
    date: filters.get('date'),
    search: filters.get('search'),
    page: filters.page,
  })
  const [selected, setSelected] = useState<number | null>(null)
  const setSearch = useDebouncedCallback((value: string) => filters.set('search', value.trim()))

  return (
    <div className="grid gap-6">
      <PageHeader title="Réservations" description="Réservations des voyageurs sur les trajets de vos agences." />

      <div className="flex flex-wrap items-end gap-3" role="search" aria-label="Filtrer les réservations">
        <div className="grid gap-1.5">
          <Label htmlFor="reservation-search">Référence</Label>
          <Input
            id="reservation-search"
            className="w-48 font-mono uppercase"
            placeholder="R237-…"
            defaultValue={filters.get('search') ?? ''}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="reservation-status">Statut</Label>
          <Select value={status ?? ALL} onValueChange={(value) => filters.set('status', value === ALL ? undefined : value)}>
            <SelectTrigger id="reservation-status" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous</SelectItem>
              {STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {RESERVATION_STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="reservation-date">Date de départ</Label>
          <Input id="reservation-date" type="date" className="w-40" value={filters.get('date') ?? ''} onChange={(event) => filters.set('date', event.target.value)} />
        </div>
        {tripId && (
          <Button variant="outline" size="sm" onClick={() => filters.set('trip_id', undefined)}>
            <X aria-hidden="true" />
            Trajet n° {tripId}
          </Button>
        )}
      </div>

      {reservations.isPending && <LoadingState rows={4} />}
      {reservations.isError && <ErrorState message={getErrorMessage(reservations.error)} onRetry={() => reservations.refetch()} />}
      {reservations.data && reservations.data.data.length === 0 && (
        <EmptyState icon={<Ticket className="size-8 text-muted-foreground" aria-hidden="true" />} title="Aucune réservation pour ces critères." />
      )}

      {reservations.data && reservations.data.data.length > 0 && (
        <div className="grid gap-4">
          <div className="overflow-x-auto rounded-xl border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Trajet</TableHead>
                  <TableHead>Passagers</TableHead>
                  <TableHead className="hidden md:table-cell">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.data.data.map((reservation) => (
                  <TableRow key={reservation.id} className="cursor-pointer" onClick={() => setSelected(reservation.id)}>
                    <TableCell>
                      <button
                        type="button"
                        className="font-mono text-sm font-medium underline-offset-4 hover:underline"
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelected(reservation.id)
                        }}
                      >
                        {reservation.reference}
                      </button>
                    </TableCell>
                    <TableCell>
                      {reservation.customer?.name}
                      <span className="block text-xs text-muted-foreground">{reservation.customer?.phone ?? reservation.customer?.email}</span>
                    </TableCell>
                    <TableCell>
                      {reservation.trip && (
                        <>
                          {reservation.trip.departure_city.name} → {reservation.trip.destination_city.name}
                          <span className="block text-xs text-muted-foreground">
                            {formatDate(reservation.trip.departure_date, 'short')} à {reservation.trip.departure_time}
                          </span>
                        </>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">{reservation.passenger_count}</TableCell>
                    <TableCell className="hidden whitespace-nowrap md:table-cell">{formatPrice(reservation.total_amount)}</TableCell>
                    <TableCell>
                      <ReservationStatusBadge status={reservation.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination meta={reservations.data.meta} onPageChange={filters.setPage} />
        </div>
      )}

      <ReservationSheet reservationId={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
