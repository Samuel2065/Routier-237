import { Ticket } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { PageHeader } from '@/components/common/page-header'
import { Pagination } from '@/components/common/pagination'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMyReservations } from '@/features/reservations/queries'
import { ReservationCard } from '@/features/reservations/reservation-card'
import { RESERVATION_STATUS_LABELS } from '@/lib/labels'
import type { ReservationStatus } from '@/types/api'

const STATUSES: ReservationStatus[] = ['pending', 'confirmed', 'cancelled', 'expired']
const ALL = 'all'

/**
 * Réservations du client connecté (/account/reservations) — uniquement les siennes (A9).
 */
export function ReservationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const statusParam = searchParams.get('status')
  const status = STATUSES.find((value) => value === statusParam)
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1)
  const reservations = useMyReservations({ status, page })

  const update = (next: { status?: string; page?: number }) => {
    const params = new URLSearchParams()
    const nextStatus = next.status ?? status ?? ALL
    if (nextStatus !== ALL) params.set('status', nextStatus)
    if (next.page && next.page > 1) params.set('page', String(next.page))
    setSearchParams(params)
  }

  return (
    <div className="grid gap-6">
      <PageHeader title="Mes réservations" description="Suivez le statut et le paiement de vos réservations." />

      <Tabs value={status ?? ALL} onValueChange={(value) => update({ status: value, page: 1 })}>
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value={ALL}>Toutes</TabsTrigger>
          {STATUSES.map((value) => (
            <TabsTrigger key={value} value={value}>
              {RESERVATION_STATUS_LABELS[value]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {reservations.isPending && <LoadingState rows={3} />}
      {reservations.isError && <ErrorState onRetry={() => reservations.refetch()} />}
      {reservations.data && reservations.data.data.length === 0 && (
        <EmptyState
          icon={<Ticket className="size-8 text-muted-foreground" aria-hidden="true" />}
          title="Aucune réservation"
          action={
            <Button asChild>
              <Link to="/">Rechercher un trajet</Link>
            </Button>
          }
        />
      )}
      {reservations.data && reservations.data.data.length > 0 && (
        <>
          <ul className="grid gap-3">
            {reservations.data.data.map((reservation) => (
              <li key={reservation.id}>
                <ReservationCard reservation={reservation} />
              </li>
            ))}
          </ul>
          <Pagination meta={reservations.data.meta} onPageChange={(next) => update({ page: next })} />
        </>
      )}
    </div>
  )
}
