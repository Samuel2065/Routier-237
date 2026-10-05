import { Activity } from 'lucide-react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { PageHeader } from '@/components/common/page-header'
import { Pagination } from '@/components/common/pagination'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { PaymentStatusBadge, ReservationStatusBadge, TripStatusBadge } from '@/components/common/status-badges'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAdminPayments, useAdminReservations, useAdminTrips, useOrganizations } from '@/features/admin/queries'
import { useDebouncedCallback } from '@/hooks/use-debounced-callback'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { getErrorMessage } from '@/lib/api-error'
import { formatDate, formatDateTime, formatPrice } from '@/lib/format'
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, RESERVATION_STATUS_LABELS, TRIP_STATUS_LABELS } from '@/lib/labels'
import type { PaginationMeta } from '@/types/api'

const ALL = 'all'
const TABS = { trips: 'Trajets', reservations: 'Réservations', payments: 'Paiements' } as const
type Tab = keyof typeof TABS

/**
 * Activité de toute la plateforme (/admin/activity), en lecture seule : trajets, réservations
 * et paiements, filtrables par organisation. Les actions (annuler, rembourser) restent aux
 * agences ; les données personnelles sont réduites (client par son nom, numéro masqué).
 */
export function AdminActivityPage() {
  const filters = useUrlFilters()
  const [, setSearchParams] = useSearchParams()
  const tab: Tab = filters.get('tab') === 'reservations' || filters.get('tab') === 'payments' ? (filters.get('tab') as Tab) : 'trips'
  const organizations = useOrganizations({ per_page: 100 })

  // Changer d'onglet ne garde que l'organisation (les statuts diffèrent d'un onglet à l'autre).
  const changeTab = (value: string) => {
    const next = new URLSearchParams()
    if (value !== 'trips') next.set('tab', value)
    const organization = filters.get('organization_id')
    if (organization) next.set('organization_id', organization)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Activité de la plateforme"
        description="Trajets, réservations et paiements de toutes les organisations, en lecture seule. Les actions restent aux agences concernées."
      />

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList>
          {(Object.keys(TABS) as Tab[]).map((key) => (
            <TabsTrigger key={key} value={key}>
              {TABS[key]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-end gap-3" role="search" aria-label={`Filtrer : ${TABS[tab]}`}>
        <FilterSelect
          id="activity-organization"
          label="Organisation"
          value={filters.get('organization_id')}
          onChange={(value) => filters.set('organization_id', value)}
          options={(organizations.data?.data ?? []).map((organization) => [String(organization.id), organization.name])}
          width="w-56"
        />
        {tab === 'trips' && <TripFilters />}
        {tab === 'reservations' && <ReservationFilters />}
        {tab === 'payments' && <PaymentFilters />}
      </div>

      {tab === 'trips' && <TripsTable />}
      {tab === 'reservations' && <ReservationsTable />}
      {tab === 'payments' && <PaymentsTable />}
    </div>
  )
}

/* Filtres -------------------------------------------------------------------- */

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  width = 'w-44',
}: {
  id: string
  label: string
  value: string | undefined
  onChange: (value: string | undefined) => void
  options: [string, string][]
  width?: string
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value ?? ALL} onValueChange={(next) => onChange(next === ALL ? undefined : next)}>
        <SelectTrigger id={id} className={width}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Toutes</SelectItem>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function DateFilter({ id, label, param }: { id: string; label: string; param: string }) {
  const filters = useUrlFilters()
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="date" className="w-40" value={filters.get(param) ?? ''} onChange={(event) => filters.set(param, event.target.value)} />
    </div>
  )
}

function TripFilters() {
  const filters = useUrlFilters()
  return (
    <>
      <FilterSelect id="trip-status" label="Statut" value={filters.get('status')} onChange={(value) => filters.set('status', value)} options={Object.entries(TRIP_STATUS_LABELS)} />
      <DateFilter id="trip-from" label="Départ du" param="date_from" />
      <DateFilter id="trip-to" label="au" param="date_to" />
    </>
  )
}

function ReservationFilters() {
  const filters = useUrlFilters()
  const setSearch = useDebouncedCallback((value: string) => filters.set('search', value.trim()))
  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor="reservation-search">Référence</Label>
        <Input id="reservation-search" className="w-44" placeholder="R237-…" defaultValue={filters.get('search') ?? ''} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <FilterSelect
        id="reservation-status"
        label="Statut"
        value={filters.get('status')}
        onChange={(value) => filters.set('status', value)}
        options={Object.entries(RESERVATION_STATUS_LABELS)}
      />
      <DateFilter id="reservation-date" label="Date de départ" param="date" />
    </>
  )
}

function PaymentFilters() {
  const filters = useUrlFilters()
  return (
    <>
      <FilterSelect id="payment-status" label="Statut" value={filters.get('status')} onChange={(value) => filters.set('status', value)} options={Object.entries(PAYMENT_STATUS_LABELS)} />
      <FilterSelect id="payment-method" label="Moyen" value={filters.get('method')} onChange={(value) => filters.set('method', value)} options={Object.entries(PAYMENT_METHOD_LABELS)} />
      <DateFilter id="payment-from" label="Du" param="date_from" />
      <DateFilter id="payment-to" label="au" param="date_to" />
      <div className="flex h-9 items-center gap-2">
        <Checkbox
          id="payment-refund"
          checked={filters.get('requires_refund') === '1'}
          onCheckedChange={(checked) => filters.set('requires_refund', checked === true ? '1' : undefined)}
        />
        <Label htmlFor="payment-refund">À rembourser</Label>
      </div>
    </>
  )
}

/* Tableaux ------------------------------------------------------------------- */

function useListParams(keys: string[]) {
  const filters = useUrlFilters()
  const params: Record<string, string | number | undefined> = { page: filters.page }
  for (const key of ['organization_id', ...keys]) params[key] = filters.get(key)
  return params
}

function ListShell({
  query,
  headers,
  children,
  emptyLabel,
}: {
  query: { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown; data?: { data: unknown[]; meta: PaginationMeta } }
  headers: ReactNode
  children: ReactNode
  emptyLabel: string
}) {
  const filters = useUrlFilters()

  if (query.isPending) return <LoadingState rows={4} />
  if (query.isError) return <ErrorState message={getErrorMessage(query.error)} onRetry={() => query.refetch()} />
  if (!query.data || query.data.data.length === 0) {
    return <EmptyState icon={<Activity className="size-8 text-muted-foreground" aria-hidden="true" />} title={emptyLabel} />
  }

  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>{headers}</TableRow>
          </TableHeader>
          <TableBody>{children}</TableBody>
        </Table>
      </div>
      <Pagination meta={query.data.meta} onPageChange={filters.setPage} />
    </div>
  )
}

function Scope({ agency, organization }: { agency: string; organization?: string }) {
  return (
    <TableCell className="text-sm">
      {agency}
      {organization && <span className="block text-xs text-muted-foreground">{organization}</span>}
    </TableCell>
  )
}

function TripsTable() {
  const trips = useAdminTrips(useListParams(['status', 'date_from', 'date_to']))

  return (
    <ListShell
      query={trips}
      emptyLabel="Aucun trajet pour ces critères."
      headers={
        <>
          <TableHead>Trajet</TableHead>
          <TableHead>Départ</TableHead>
          <TableHead>Agence</TableHead>
          <TableHead className="text-right">Places</TableHead>
          <TableHead>Statut</TableHead>
        </>
      }
    >
      {trips.data?.data.map((trip) => (
        <TableRow key={trip.id}>
          <TableCell className="font-medium">
            {trip.route.departure_city.name} → {trip.route.destination_city.name}
            <span className="block text-xs text-muted-foreground">
              {trip.travel_class.name} · {formatPrice(trip.price)}
            </span>
          </TableCell>
          <TableCell className="whitespace-nowrap text-sm">
            {formatDate(trip.departure_date, 'short')} à {trip.departure_time}
          </TableCell>
          <Scope agency={trip.agency.name} organization={trip.agency.organization?.name} />
          <TableCell className="text-right text-sm tabular-nums">
            {trip.reserved_seats} / {trip.capacity}
          </TableCell>
          <TableCell>
            <TripStatusBadge status={trip.status} />
          </TableCell>
        </TableRow>
      ))}
    </ListShell>
  )
}

function ReservationsTable() {
  const reservations = useAdminReservations(useListParams(['status', 'date', 'search']))

  return (
    <ListShell
      query={reservations}
      emptyLabel="Aucune réservation pour ces critères."
      headers={
        <>
          <TableHead>Référence</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Trajet</TableHead>
          <TableHead>Agence</TableHead>
          <TableHead className="text-right">Montant</TableHead>
          <TableHead>Statut</TableHead>
        </>
      }
    >
      {reservations.data?.data.map((reservation) => (
        <TableRow key={reservation.id}>
          <TableCell className="font-mono text-sm">
            {reservation.reference}
            <span className="block font-sans text-xs text-muted-foreground">{formatDateTime(reservation.created_at)}</span>
          </TableCell>
          <TableCell className="text-sm">{reservation.customer.name}</TableCell>
          <TableCell className="text-sm">
            {reservation.trip.departure_city} → {reservation.trip.destination_city}
            <span className="block text-xs text-muted-foreground">
              {formatDate(reservation.trip.departure_date, 'short')} à {reservation.trip.departure_time} · {reservation.passenger_count} passager(s)
            </span>
          </TableCell>
          <Scope agency={reservation.agency.name} organization={reservation.organization.name} />
          <TableCell className="text-right text-sm tabular-nums">{formatPrice(reservation.total_amount)}</TableCell>
          <TableCell>
            <ReservationStatusBadge status={reservation.status} />
          </TableCell>
        </TableRow>
      ))}
    </ListShell>
  )
}

function PaymentsTable() {
  const payments = useAdminPayments(useListParams(['status', 'method', 'date_from', 'date_to', 'requires_refund']))

  return (
    <ListShell
      query={payments}
      emptyLabel="Aucun paiement pour ces critères."
      headers={
        <>
          <TableHead>Réservation</TableHead>
          <TableHead>Moyen</TableHead>
          <TableHead>Agence</TableHead>
          <TableHead className="text-right">Montant</TableHead>
          <TableHead>Statut</TableHead>
        </>
      }
    >
      {payments.data?.data.map((payment) => (
        <TableRow key={payment.id}>
          <TableCell className="font-mono text-sm">
            {payment.reservation.reference}
            <span className="block font-sans text-xs text-muted-foreground">{formatDateTime(payment.created_at)}</span>
          </TableCell>
          <TableCell className="text-sm">
            {PAYMENT_METHOD_LABELS[payment.method]}
            {payment.payer_phone && <span className="block text-xs text-muted-foreground">N° {payment.payer_phone}</span>}
          </TableCell>
          <Scope agency={payment.agency.name} organization={payment.organization.name} />
          <TableCell className="text-right text-sm tabular-nums">{formatPrice(payment.amount)}</TableCell>
          <TableCell>
            <div className="flex flex-wrap gap-1">
              <PaymentStatusBadge status={payment.status} />
              {payment.requires_refund && <Badge variant="destructive">À rembourser</Badge>}
            </div>
          </TableCell>
        </TableRow>
      ))}
    </ListShell>
  )
}
