import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Building2, CalendarDays, Phone } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { Container } from '@/components/layout/container'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { PaymentStatusBadge, ReservationStatusBadge } from '@/components/common/status-badges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PaymentForm } from '@/features/payments/payment-form'
import { isPaymentInProgress } from '@/features/payments/queries'
import { PaymentTracker } from '@/features/payments/payment-tracker'
import { CancelReservationButton } from '@/features/reservations/cancel-reservation-button'
import { ExpiryCountdown } from '@/features/reservations/expiry-countdown'
import { useMyReservation } from '@/features/reservations/queries'
import { getErrorMessage, getStatus } from '@/lib/api-error'
import { formatDate, formatDateTime, formatPrice } from '@/lib/format'
import { PASSENGER_TYPE_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/labels'
import { queryKeys } from '@/lib/query-keys'
import { useSession } from '@/store/auth-store'

/**
 * Détail d'une réservation du client : statut, passagers, paiement et annulation.
 * C'est ici que se termine le parcours de réservation (paiement, §5.2 étapes 8-9).
 */
export function ReservationDetailPage() {
  const { id } = useParams()
  const reservationId = Number(id)
  const queryClient = useQueryClient()
  const session = useSession('customer')
  const query = useMyReservation(reservationId)

  if (query.isPending) {
    return (
      <Container>
        <LoadingState rows={3} />
      </Container>
    )
  }

  if (query.isError) {
    const status = getStatus(query.error)
    return (
      <Container>
        {status === 404 || status === 403 ? (
          <EmptyState
            title="Réservation introuvable"
            action={
              <Button asChild>
                <Link to="/account/reservations">Mes réservations</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState message={getErrorMessage(query.error)} onRetry={() => query.refetch()} />
        )}
      </Container>
    )
  }

  const reservation = query.data
  const trip = reservation.trip
  const payments = reservation.payments ?? []
  const activePayment = payments.find(isPaymentInProgress)
  const lastPayment = payments[payments.length - 1]
  const expired = reservation.expires_at !== null && new Date(reservation.expires_at) <= new Date()
  const departed = trip ? new Date(trip.departs_at) <= new Date() : false
  const canPay = reservation.status === 'pending' && !expired && !activePayment
  const canCancel = (reservation.status === 'pending' || reservation.status === 'confirmed') && !departed

  return (
    <Container className="grid max-w-4xl gap-6">
      <Button variant="ghost" className="w-fit" asChild>
        <Link to="/account/reservations">
          <ArrowLeft aria-hidden="true" />
          Mes réservations
        </Link>
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-1">
          <h1 className="font-mono text-2xl font-semibold">{reservation.reference}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <ReservationStatusBadge status={reservation.status} />
            <span>Réservée le {formatDateTime(reservation.created_at)}</span>
          </div>
        </div>
        {canCancel && <CancelReservationButton reservation={reservation} />}
      </div>

      {reservation.status === 'pending' && reservation.expires_at && (
        <ExpiryCountdown
          expiresAt={reservation.expires_at}
          onExpire={() => queryClient.invalidateQueries({ queryKey: queryKeys.myReservation(reservationId) })}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="grid content-start gap-6">
          {trip && (
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {trip.departure_city.name} → {trip.destination_city.name}
                  <Badge variant="secondary">{trip.travel_class.name}</Badge>
                </CardTitle>
                <CardDescription className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-4" aria-hidden="true" />
                    {formatDate(trip.departure_date)} à {trip.departure_time}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="size-4" aria-hidden="true" />
                    {trip.agency.name}
                  </span>
                  {trip.agency.phone && (
                    <a href={`tel:${trip.agency.phone}`} className="inline-flex items-center gap-1 hover:underline">
                      <Phone className="size-4" aria-hidden="true" />
                      {trip.agency.phone}
                    </a>
                  )}
                </CardDescription>
              </CardHeader>
              {trip.status === 'cancelled' && (
                <CardContent>
                  <p className="text-sm font-medium text-destructive">Ce trajet a été annulé par l'agence.</p>
                </CardContent>
              )}
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Passagers ({reservation.passenger_count})</CardTitle>
              <CardDescription>Réservation nominative et non transférable.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {reservation.passengers?.map((passenger) => (
                  <li key={passenger.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="font-medium">{passenger.full_name}</span>
                    <span className="text-muted-foreground">
                      {PASSENGER_TYPE_LABELS[passenger.passenger_type]}
                      {passenger.phone && ` · ${passenger.phone}`}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="content-start">
          <CardHeader>
            <CardTitle>Paiement</CardTitle>
            <CardDescription>
              Montant : <span className="font-semibold text-foreground">{formatPrice(reservation.total_amount)}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {activePayment && <PaymentTracker payment={activePayment} reservationId={reservation.id} />}

            {!activePayment && lastPayment && reservation.status !== 'pending' && (
              <PaymentTracker payment={lastPayment} reservationId={reservation.id} />
            )}

            {canPay && (
              <>
                {lastPayment?.status === 'failed' && (
                  <p className="text-sm text-muted-foreground">Le paiement précédent a échoué : vous pouvez réessayer.</p>
                )}
                <PaymentForm reservationId={reservation.id} amount={reservation.total_amount} defaultPhone={session?.user.phone} />
              </>
            )}

            {reservation.status === 'pending' && expired && !activePayment && (
              <p className="text-sm text-muted-foreground">Le délai de paiement est dépassé : les places ont été libérées.</p>
            )}

            {payments.length > 1 && (
              <div className="grid gap-2">
                <p className="text-sm font-medium">Historique</p>
                <ul className="grid gap-1 text-sm">
                  {payments.map((payment) => (
                    <li key={payment.id} className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">
                        {PAYMENT_METHOD_LABELS[payment.method]} · {formatDateTime(payment.created_at)}
                      </span>
                      <PaymentStatusBadge status={payment.status} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Container>
  )
}
