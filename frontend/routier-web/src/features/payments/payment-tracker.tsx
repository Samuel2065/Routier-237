import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, FlaskConical, Loader2, XCircle } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { PaymentStatusBadge } from '@/components/common/status-badges'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { isPaymentInProgress, usePayment, useSimulatePayment } from '@/features/payments/queries'
import { getErrorMessage } from '@/lib/api-error'
import { formatPrice } from '@/lib/format'
import { PAYMENT_METHOD_LABELS } from '@/lib/labels'
import { queryKeys } from '@/lib/query-keys'
import type { Payment } from '@/types/api'

/**
 * Suivi d'un paiement en cours : l'API est interrogée jusqu'au résultat du fournisseur.
 * Avec la passerelle simulée (développement), le résultat peut être déclenché ici.
 */
export function PaymentTracker({ payment: initial, reservationId }: { payment: Payment; reservationId: number }) {
  const queryClient = useQueryClient()
  const { data: payment = initial } = usePayment(initial.id, initial)
  const simulate = useSimulatePayment(reservationId)
  const previousStatus = useRef(payment.status)

  // Fin du traitement détectée par le suivi : la réservation a changé de statut.
  useEffect(() => {
    if (previousStatus.current === payment.status) return
    previousStatus.current = payment.status

    if (!isPaymentInProgress(payment)) {
      queryClient.invalidateQueries({ queryKey: queryKeys.myReservation(reservationId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationsAll })
      if (payment.status === 'paid') toast.success('Paiement confirmé : votre réservation est confirmée.')
      if (payment.status === 'failed') toast.error('Le paiement a échoué. Vous pouvez réessayer.')
    }
  }, [payment, queryClient, reservationId])

  const inProgress = isPaymentInProgress(payment)

  return (
    <div className="grid gap-4" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid gap-0.5">
          <p className="font-medium">
            {PAYMENT_METHOD_LABELS[payment.method]} · {formatPrice(payment.amount)}
          </p>
          {payment.transaction_reference && (
            <p className="font-mono text-xs text-muted-foreground">Réf. {payment.transaction_reference}</p>
          )}
        </div>
        <PaymentStatusBadge status={payment.status} />
      </div>

      {inProgress && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {payment.method === 'card'
            ? 'Paiement en cours de traitement…'
            : `Validez le paiement sur le téléphone ${payment.payer_phone ?? ''}, puis patientez.`}
        </p>
      )}

      {payment.status === 'paid' && (
        <Alert>
          <CheckCircle2 aria-hidden="true" />
          <AlertTitle>Paiement confirmé</AlertTitle>
          <AlertDescription>Présentez la référence de votre réservation au guichet de l'agence.</AlertDescription>
        </Alert>
      )}

      {payment.status === 'failed' && (
        <Alert variant="destructive">
          <XCircle aria-hidden="true" />
          <AlertTitle>Paiement échoué</AlertTitle>
          <AlertDescription>{payment.failure_reason ?? 'Le paiement a été refusé.'}</AlertDescription>
        </Alert>
      )}

      {inProgress && payment.provider === 'mock' && (
        <div className="grid gap-3 rounded-lg border border-dashed border-amber-400 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
            <FlaskConical className="size-4" aria-hidden="true" />
            Mode simulation : aucun paiement réel n'est effectué.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={simulate.isPending}
              onClick={() =>
                simulate.mutate({ paymentId: payment.id, outcome: 'paid' }, { onError: (error) => toast.error(getErrorMessage(error)) })
              }
            >
              Simuler un paiement réussi
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={simulate.isPending}
              onClick={() =>
                simulate.mutate({ paymentId: payment.id, outcome: 'failed' }, { onError: (error) => toast.error(getErrorMessage(error)) })
              }
            >
              Simuler un échec
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
