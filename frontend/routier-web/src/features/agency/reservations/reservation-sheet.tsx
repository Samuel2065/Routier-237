import { Loader2, Mail, Phone, XCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog, type ConfirmRequest } from '@/components/common/confirm-dialog'
import { ErrorState, LoadingState } from '@/components/common/states'
import { PaymentStatusBadge, ReservationStatusBadge } from '@/components/common/status-badges'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useAgencyReservation, useCancelAgencyReservation } from '@/features/agency/queries'
import { useCan } from '@/features/agency/session'
import { getErrorMessage } from '@/lib/api-error'
import { formatDate, formatDateTime, formatPrice } from '@/lib/format'
import { PASSENGER_TYPE_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/labels'

/**
 * Détail d'une réservation pour le guichet : client, passagers, paiements, annulation.
 */
export function ReservationSheet({ reservationId, onClose }: { reservationId: number | null; onClose: () => void }) {
  const can = useCan()
  const reservation = useAgencyReservation(reservationId)
  const cancel = useCancelAgencyReservation()
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const data = reservation.data

  const askCancel = () => {
    if (!data) return
    setConfirm({
      title: `Annuler la réservation ${data.reference} ?`,
      description:
        data.status === 'confirmed'
          ? 'Les places seront libérées et le client notifié. Le paiement apparaîtra « à rembourser ».'
          : 'Les places seront libérées et le client notifié.',
      confirmLabel: 'Annuler la réservation',
      destructive: true,
      onConfirm: () =>
        cancel.mutate(data.id, {
          onSuccess: () => toast.success('Réservation annulée, client notifié.'),
          onError: (error) => toast.error(getErrorMessage(error)),
          onSettled: () => setConfirm(null),
        }),
    })
  }

  return (
    <Sheet open={reservationId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-mono">{data?.reference ?? 'Réservation'}</SheetTitle>
          <SheetDescription>{data && `Réservée le ${formatDateTime(data.created_at)}`}</SheetDescription>
        </SheetHeader>

        <div className="grid gap-5 px-4 pb-6">
          {reservation.isPending && <LoadingState rows={2} />}
          {reservation.isError && <ErrorState message={getErrorMessage(reservation.error)} onRetry={() => reservation.refetch()} />}

          {data && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <ReservationStatusBadge status={data.status} />
                <span className="text-sm text-muted-foreground">
                  {data.passenger_count} passager(s) · {formatPrice(data.total_amount)}
                </span>
              </div>

              {data.trip && (
                <div className="grid gap-1 text-sm">
                  <p className="font-medium">
                    {data.trip.departure_city.name} → {data.trip.destination_city.name} · {data.trip.travel_class.name}
                  </p>
                  <p className="text-muted-foreground">
                    {formatDate(data.trip.departure_date)} à {data.trip.departure_time} · {data.trip.agency.name}
                  </p>
                </div>
              )}

              {data.customer && (
                <div className="grid gap-1 text-sm">
                  <p className="font-medium">Client : {data.customer.name}</p>
                  <a href={`mailto:${data.customer.email}`} className="inline-flex items-center gap-1.5 text-muted-foreground hover:underline">
                    <Mail className="size-4" aria-hidden="true" />
                    {data.customer.email}
                  </a>
                  {data.customer.phone && (
                    <a href={`tel:${data.customer.phone}`} className="inline-flex items-center gap-1.5 text-muted-foreground hover:underline">
                      <Phone className="size-4" aria-hidden="true" />
                      {data.customer.phone}
                    </a>
                  )}
                </div>
              )}

              <Separator />

              <section aria-labelledby="passengers-heading" className="grid gap-2">
                <h3 id="passengers-heading" className="text-sm font-medium">
                  Passagers
                </h3>
                <ul className="divide-y rounded-lg border">
                  {data.passengers?.map((passenger) => (
                    <li key={passenger.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="font-medium">{passenger.full_name}</span>
                      <span className="text-muted-foreground">
                        {PASSENGER_TYPE_LABELS[passenger.passenger_type]}
                        {passenger.phone && ` · ${passenger.phone}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section aria-labelledby="payments-heading" className="grid gap-2">
                <h3 id="payments-heading" className="text-sm font-medium">
                  Paiements
                </h3>
                {data.payments && data.payments.length > 0 ? (
                  <ul className="grid gap-2 text-sm">
                    {data.payments.map((payment) => (
                      <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                        <span>
                          {PAYMENT_METHOD_LABELS[payment.method]} · {formatPrice(payment.amount)}
                          <span className="block text-xs text-muted-foreground">{formatDateTime(payment.created_at)}</span>
                        </span>
                        <PaymentStatusBadge status={payment.status} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucun paiement.</p>
                )}
              </section>

              {can('reservations.cancel') && (data.status === 'pending' || data.status === 'confirmed') && data.trip?.status !== 'completed' && (
                <Button variant="destructive" className="w-fit" onClick={askCancel} disabled={cancel.isPending}>
                  {cancel.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <XCircle aria-hidden="true" />}
                  Annuler la réservation
                </Button>
              )}
            </>
          )}
        </div>

        <ConfirmDialog request={confirm} pending={cancel.isPending} onClose={() => setConfirm(null)} />
      </SheetContent>
    </Sheet>
  )
}
