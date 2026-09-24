import { Badge } from '@/components/ui/badge'
import { PAYMENT_STATUS_LABELS, RESERVATION_STATUS_LABELS } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { PaymentStatus, ReservationStatus } from '@/types/api'

const TONES = {
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-sky-100 text-sky-800',
} as const

const RESERVATION_TONES: Record<ReservationStatus, keyof typeof TONES> = {
  pending: 'warning',
  confirmed: 'success',
  cancelled: 'danger',
  expired: 'neutral',
}

const PAYMENT_TONES: Record<PaymentStatus, keyof typeof TONES> = {
  pending: 'neutral',
  processing: 'info',
  paid: 'success',
  failed: 'danger',
  cancelled: 'neutral',
  refunded: 'info',
}

export function ReservationStatusBadge({ status, className }: { status: ReservationStatus; className?: string }) {
  return (
    <Badge variant="secondary" className={cn(TONES[RESERVATION_TONES[status]], className)}>
      {RESERVATION_STATUS_LABELS[status]}
    </Badge>
  )
}

export function PaymentStatusBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  return (
    <Badge variant="secondary" className={cn(TONES[PAYMENT_TONES[status]], className)}>
      {PAYMENT_STATUS_LABELS[status]}
    </Badge>
  )
}
