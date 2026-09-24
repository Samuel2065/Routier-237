import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createPayment, fetchPayment, simulatePayment, type CreatePaymentPayload } from '@/api/payments'
import { queryKeys } from '@/lib/query-keys'
import type { Payment } from '@/types/api'

const POLL_INTERVAL_MS = 3000

export function isPaymentInProgress(payment: Pick<Payment, 'status'>): boolean {
  return payment.status === 'pending' || payment.status === 'processing'
}

export function useCreatePayment(reservationId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreatePaymentPayload) => createPayment(reservationId, payload),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(queryKeys.payment(data.id), data)
      queryClient.invalidateQueries({ queryKey: queryKeys.myReservation(reservationId) })
    },
  })
}

/**
 * Suivi d'un paiement : interroge l'API tant que le fournisseur n'a pas donné de résultat.
 */
export function usePayment(id: number, initial?: Payment) {
  return useQuery({
    queryKey: queryKeys.payment(id),
    queryFn: () => fetchPayment(id),
    initialData: initial,
    refetchInterval: (query) => (query.state.data && isPaymentInProgress(query.state.data) ? POLL_INTERVAL_MS : false),
  })
}

export function useSimulatePayment(reservationId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ paymentId, outcome }: { paymentId: number; outcome: 'paid' | 'failed' }) => simulatePayment(paymentId, outcome),
    onSuccess: (payment) => {
      queryClient.setQueryData(queryKeys.payment(payment.id), payment)
      queryClient.invalidateQueries({ queryKey: queryKeys.myReservation(reservationId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.myReservationsAll })
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationsAll })
    },
  })
}
