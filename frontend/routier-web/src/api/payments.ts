import { customerApi } from '@/api/client'
import type { Envelope, Payment, PaymentMethod } from '@/types/api'

export interface CreatePaymentPayload {
  method: PaymentMethod
  phone?: string | null
}

export interface PaymentInitiationResponse {
  data: Payment
  meta: { instructions: string | null; redirect_url: string | null }
}

export async function createPayment(reservationId: number, payload: CreatePaymentPayload): Promise<PaymentInitiationResponse> {
  const { data } = await customerApi.post<PaymentInitiationResponse>(`/account/reservations/${reservationId}/payments`, payload)
  return data
}

export async function fetchPayment(id: number): Promise<Payment> {
  const { data } = await customerApi.get<Envelope<Payment>>(`/account/payments/${id}`)
  return data.data
}

/** Passerelle simulée uniquement (développement) : l'API répond 404 ailleurs. */
export async function simulatePayment(id: number, outcome: 'paid' | 'failed'): Promise<Payment> {
  const { data } = await customerApi.post<Envelope<Payment>>(`/account/payments/${id}/simulate`, { outcome })
  return data.data
}
