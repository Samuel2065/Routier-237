import { Badge } from '@/components/ui/badge'
import {
  EMPLOYEE_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  RECORD_STATUS_LABELS,
  RESERVATION_STATUS_LABELS,
  TRIP_STATUS_LABELS,
  VEHICLE_STATUS_LABELS,
} from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { EmployeeStatus, PaymentStatus, RecordStatus, ReservationStatus, TripStatus, VehicleStatus } from '@/types/api'

const TONES = {
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-sky-100 text-sky-800',
} as const

type Tone = keyof typeof TONES

function StatusBadge({ tone, label, className }: { tone: Tone; label: string; className?: string }) {
  return (
    <Badge variant="secondary" className={cn(TONES[tone], className)}>
      {label}
    </Badge>
  )
}

const RESERVATION_TONES: Record<ReservationStatus, Tone> = { pending: 'warning', confirmed: 'success', cancelled: 'danger', expired: 'neutral' }
const PAYMENT_TONES: Record<PaymentStatus, Tone> = {
  pending: 'neutral',
  processing: 'info',
  paid: 'success',
  failed: 'danger',
  cancelled: 'neutral',
  refunded: 'info',
}
const TRIP_TONES: Record<TripStatus, Tone> = { draft: 'neutral', published: 'success', cancelled: 'danger', completed: 'info' }
const VEHICLE_TONES: Record<VehicleStatus, Tone> = { active: 'success', maintenance: 'warning', retired: 'neutral' }
const EMPLOYEE_TONES: Record<EmployeeStatus, Tone> = { active: 'success', suspended: 'warning', terminated: 'neutral' }
const RECORD_TONES: Record<RecordStatus, Tone> = { active: 'success', inactive: 'neutral' }

export function ReservationStatusBadge({ status, className }: { status: ReservationStatus; className?: string }) {
  return <StatusBadge tone={RESERVATION_TONES[status]} label={RESERVATION_STATUS_LABELS[status]} className={className} />
}

export function PaymentStatusBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  return <StatusBadge tone={PAYMENT_TONES[status]} label={PAYMENT_STATUS_LABELS[status]} className={className} />
}

export function TripStatusBadge({ status }: { status: TripStatus }) {
  return <StatusBadge tone={TRIP_TONES[status]} label={TRIP_STATUS_LABELS[status]} />
}

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  return <StatusBadge tone={VEHICLE_TONES[status]} label={VEHICLE_STATUS_LABELS[status]} />
}

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  return <StatusBadge tone={EMPLOYEE_TONES[status]} label={EMPLOYEE_STATUS_LABELS[status]} />
}

export function RecordStatusBadge({ status }: { status: RecordStatus }) {
  return <StatusBadge tone={RECORD_TONES[status]} label={RECORD_STATUS_LABELS[status]} />
}
