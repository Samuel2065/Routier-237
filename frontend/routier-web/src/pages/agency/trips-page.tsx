import { CalendarClock, MoreHorizontal, Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import type { TripAction } from '@/api/agency'
import { ConfirmDialog, type ConfirmRequest } from '@/components/common/confirm-dialog'
import { PageHeader } from '@/components/common/page-header'
import { Pagination } from '@/components/common/pagination'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { TripStatusBadge } from '@/components/common/status-badges'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AgencySelect } from '@/features/agency/agency-select'
import { useDeleteTrip, useTripAction, useTrips } from '@/features/agency/queries'
import { useCan } from '@/features/agency/session'
import { TripFormSheet } from '@/features/agency/trips/trip-form-sheet'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { getErrorMessage } from '@/lib/api-error'
import { formatDate, formatPrice } from '@/lib/format'
import { TRIP_STATUS_LABELS } from '@/lib/labels'
import type { ManagedTrip, TripStatus } from '@/types/api'

const ALL = 'all'
const STATUSES: TripStatus[] = ['draft', 'published', 'cancelled', 'completed']

const ACTION_MESSAGES: Record<TripAction, string> = {
  publish: 'Trajet publié : il est visible dans la recherche publique.',
  unpublish: 'Trajet repassé en brouillon.',
  cancel: 'Trajet annulé. Les clients concernés ont été notifiés.',
  complete: 'Trajet marqué comme terminé.',
}

/**
 * Gestion des trajets de l'agence (/agency/trips).
 */
export function AgencyTripsPage() {
  const filters = useUrlFilters()
  const navigate = useNavigate()
  const can = useCan()
  const status = STATUSES.find((value) => value === filters.get('status'))
  const query = {
    agency_id: filters.getNumber('agency_id'),
    status,
    date_from: filters.get('date_from'),
    date_to: filters.get('date_to'),
    page: filters.page,
  }
  const trips = useTrips(query)
  const tripAction = useTripAction()
  const deleteTrip = useDeleteTrip()

  const [editing, setEditing] = useState<ManagedTrip | undefined>()
  const [formOpen, setFormOpen] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  const openForm = (trip?: ManagedTrip) => {
    setEditing(trip)
    setFormOpen(true)
  }

  const run = (trip: ManagedTrip, action: TripAction) =>
    tripAction.mutate(
      { id: trip.id, action },
      {
        onSuccess: () => toast.success(ACTION_MESSAGES[action]),
        onError: (error) => toast.error(getErrorMessage(error)),
        onSettled: () => setConfirm(null),
      },
    )

  const ask = (trip: ManagedTrip, action: TripAction) => {
    const label = `${trip.route.departure_city.name} → ${trip.route.destination_city.name}, ${formatDate(trip.departure_date, 'short')} à ${trip.departure_time}`
    const requests: Record<TripAction, ConfirmRequest> = {
      publish: { title: 'Publier ce trajet ?', description: `${label} sera visible et réservable par les voyageurs.`, confirmLabel: 'Publier', onConfirm: () => run(trip, 'publish') },
      unpublish: { title: 'Retirer ce trajet de la recherche ?', description: `${label} repassera en brouillon.`, confirmLabel: 'Dépublier', onConfirm: () => run(trip, 'unpublish') },
      cancel: {
        title: 'Annuler ce trajet ?',
        description: `${label}. Ses ${trip.reserved_seats} place(s) réservée(s) seront annulées et les clients notifiés. Action définitive.`,
        confirmLabel: 'Annuler le trajet',
        destructive: true,
        onConfirm: () => run(trip, 'cancel'),
      },
      complete: { title: 'Marquer ce trajet comme terminé ?', description: label, confirmLabel: 'Terminer', onConfirm: () => run(trip, 'complete') },
    }
    setConfirm(requests[action])
  }

  const askDelete = (trip: ManagedTrip) =>
    setConfirm({
      title: 'Supprimer ce brouillon ?',
      description: 'Le trajet sera définitivement supprimé.',
      confirmLabel: 'Supprimer',
      destructive: true,
      onConfirm: () =>
        deleteTrip.mutate(trip.id, {
          onSuccess: () => toast.success('Brouillon supprimé.'),
          onError: (error) => toast.error(getErrorMessage(error)),
          onSettled: () => setConfirm(null),
        }),
    })

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Trajets"
        description="Planifiez, publiez et suivez les départs."
        actions={
          can('trips.create') && (
            <Button onClick={() => openForm()}>
              <Plus aria-hidden="true" />
              Nouveau trajet
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-end gap-3" role="search" aria-label="Filtrer les trajets">
        <AgencySelect value={filters.getNumber('agency_id')} onChange={(value) => filters.set('agency_id', value)} />
        <div className="grid gap-1.5">
          <Label htmlFor="trip-status">Statut</Label>
          <Select value={status ?? ALL} onValueChange={(value) => filters.set('status', value === ALL ? undefined : value)}>
            <SelectTrigger id="trip-status" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous</SelectItem>
              {STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {TRIP_STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="trip-from">Du</Label>
          <Input id="trip-from" type="date" className="w-40" value={filters.get('date_from') ?? ''} onChange={(event) => filters.set('date_from', event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="trip-to">Au</Label>
          <Input id="trip-to" type="date" className="w-40" value={filters.get('date_to') ?? ''} onChange={(event) => filters.set('date_to', event.target.value)} />
        </div>
      </div>

      {trips.isPending && <LoadingState rows={4} />}
      {trips.isError && <ErrorState message={getErrorMessage(trips.error)} onRetry={() => trips.refetch()} />}
      {trips.data && trips.data.data.length === 0 && (
        <EmptyState icon={<CalendarClock className="size-8 text-muted-foreground" aria-hidden="true" />} title="Aucun trajet pour ces critères." />
      )}

      {trips.data && trips.data.data.length > 0 && (
        <div className="grid gap-4">
          <div className="overflow-x-auto rounded-xl border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Départ</TableHead>
                  <TableHead>Trajet</TableHead>
                  <TableHead className="hidden lg:table-cell">Véhicule</TableHead>
                  <TableHead>Prix</TableHead>
                  <TableHead>Places</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.data.data.map((trip) => {
                  const editable = trip.status === 'draft' || trip.status === 'published'
                  const departed = new Date(trip.departs_at) <= new Date()

                  return (
                    <TableRow key={trip.id}>
                      <TableCell className="whitespace-nowrap">
                        <span className="font-medium">{trip.departure_time}</span>
                        <span className="block text-xs text-muted-foreground">{formatDate(trip.departure_date, 'short')}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {trip.route.departure_city.name} → {trip.route.destination_city.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {trip.travel_class.name} · {trip.agency.name}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="font-mono text-xs">{trip.vehicle.registration_number}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatPrice(trip.price)}</TableCell>
                      <TableCell className="tabular-nums">
                        {trip.reserved_seats}/{trip.capacity}
                      </TableCell>
                      <TableCell>
                        <TripStatusBadge status={trip.status} />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions pour le trajet du ${formatDate(trip.departure_date, 'short')} à ${trip.departure_time}`}>
                              <MoreHorizontal aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {can('reservations.view') && (
                              <DropdownMenuItem onSelect={() => navigate(`/agency/reservations?trip_id=${trip.id}`)}>Voir les réservations</DropdownMenuItem>
                            )}
                            {editable && can('trips.update') && <DropdownMenuItem onSelect={() => openForm(trip)}>Modifier</DropdownMenuItem>}
                            {trip.status === 'draft' && can('trips.publish') && <DropdownMenuItem onSelect={() => ask(trip, 'publish')}>Publier</DropdownMenuItem>}
                            {trip.status === 'published' && can('trips.publish') && trip.reserved_seats === 0 && (
                              <DropdownMenuItem onSelect={() => ask(trip, 'unpublish')}>Repasser en brouillon</DropdownMenuItem>
                            )}
                            {trip.status === 'published' && departed && can('trips.update') && (
                              <DropdownMenuItem onSelect={() => ask(trip, 'complete')}>Marquer terminé</DropdownMenuItem>
                            )}
                            {editable && can('trips.cancel') && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onSelect={() => ask(trip, 'cancel')}>
                                  Annuler le trajet
                                </DropdownMenuItem>
                              </>
                            )}
                            {trip.status === 'draft' && trip.reserved_seats === 0 && can('trips.update') && (
                              <DropdownMenuItem variant="destructive" onSelect={() => askDelete(trip)}>
                                Supprimer le brouillon
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <Pagination meta={trips.data.meta} onPageChange={filters.setPage} />
        </div>
      )}

      <TripFormSheet open={formOpen} onOpenChange={setFormOpen} trip={editing} />
      <ConfirmDialog request={confirm} pending={tripAction.isPending || deleteTrip.isPending} onClose={() => setConfirm(null)} />
    </div>
  )
}
