import { Undo2, Wallet } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog, type ConfirmRequest } from '@/components/common/confirm-dialog'
import { PageHeader } from '@/components/common/page-header'
import { Pagination } from '@/components/common/pagination'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { PaymentStatusBadge } from '@/components/common/status-badges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAgencyPayments, useRefundPayment } from '@/features/agency/queries'
import { useCan } from '@/features/agency/session'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { getErrorMessage } from '@/lib/api-error'
import { formatDateTime, formatPrice } from '@/lib/format'
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/labels'
import type { Payment, PaymentMethod, PaymentStatus } from '@/types/api'

const ALL = 'all'
const STATUSES: PaymentStatus[] = ['pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded']
const METHODS: PaymentMethod[] = ['orange_money', 'mtn_momo', 'card']

/**
 * Suivi des paiements et remboursements (/agency/payments).
 */
export function AgencyPaymentsPage() {
  const filters = useUrlFilters()
  const can = useCan()
  const status = STATUSES.find((value) => value === filters.get('status'))
  const method = METHODS.find((value) => value === filters.get('method'))
  const requiresRefund = filters.get('requires_refund') === '1'
  const payments = useAgencyPayments({
    status,
    method,
    requires_refund: requiresRefund || undefined,
    date_from: filters.get('date_from'),
    date_to: filters.get('date_to'),
    page: filters.page,
  })
  const refund = useRefundPayment()
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  const askRefund = (payment: Payment) =>
    setConfirm({
      title: `Rembourser ${formatPrice(payment.amount)} ?`,
      description: `Paiement ${PAYMENT_METHOD_LABELS[payment.method]} de la réservation ${payment.reservation?.reference ?? ''}. Si la réservation est encore confirmée, elle sera annulée et le client notifié.`,
      confirmLabel: 'Rembourser',
      destructive: true,
      onConfirm: () =>
        refund.mutate(payment.id, {
          onSuccess: () => toast.success('Paiement remboursé.'),
          onError: (error) => toast.error(getErrorMessage(error)),
          onSettled: () => setConfirm(null),
        }),
    })

  return (
    <div className="grid gap-6">
      <PageHeader title="Paiements" description="Encaissements des réservations et remboursements." />

      <div className="flex flex-wrap items-end gap-3" role="search" aria-label="Filtrer les paiements">
        <div className="grid gap-1.5">
          <Label htmlFor="payment-status">Statut</Label>
          <Select value={status ?? ALL} onValueChange={(value) => filters.set('status', value === ALL ? undefined : value)}>
            <SelectTrigger id="payment-status" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous</SelectItem>
              {STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {PAYMENT_STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="payment-method">Moyen</Label>
          <Select value={method ?? ALL} onValueChange={(value) => filters.set('method', value === ALL ? undefined : value)}>
            <SelectTrigger id="payment-method" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous</SelectItem>
              {METHODS.map((value) => (
                <SelectItem key={value} value={value}>
                  {PAYMENT_METHOD_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="payment-from">Du</Label>
          <Input id="payment-from" type="date" className="w-40" value={filters.get('date_from') ?? ''} onChange={(event) => filters.set('date_from', event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="payment-to">Au</Label>
          <Input id="payment-to" type="date" className="w-40" value={filters.get('date_to') ?? ''} onChange={(event) => filters.set('date_to', event.target.value)} />
        </div>
        <div className="flex h-8 items-center gap-2">
          <Checkbox
            id="payment-refund"
            checked={requiresRefund}
            onCheckedChange={(checked) => filters.set('requires_refund', checked === true ? '1' : undefined)}
          />
          <Label htmlFor="payment-refund" className="font-normal">
            À rembourser uniquement
          </Label>
        </div>
      </div>

      {payments.isPending && <LoadingState rows={4} />}
      {payments.isError && <ErrorState message={getErrorMessage(payments.error)} onRetry={() => payments.refetch()} />}
      {payments.data && payments.data.data.length === 0 && (
        <EmptyState icon={<Wallet className="size-8 text-muted-foreground" aria-hidden="true" />} title="Aucun paiement pour ces critères." />
      )}

      {payments.data && payments.data.data.length > 0 && (
        <div className="grid gap-4">
          <div className="overflow-x-auto rounded-xl border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Réservation</TableHead>
                  <TableHead>Moyen</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead className="hidden lg:table-cell">Référence fournisseur</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-32">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.data.data.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="whitespace-nowrap text-sm">{formatDateTime(payment.paid_at ?? payment.created_at)}</TableCell>
                    <TableCell className="font-mono text-sm">{payment.reservation?.reference}</TableCell>
                    <TableCell>
                      {PAYMENT_METHOD_LABELS[payment.method]}
                      {payment.payer_phone && <span className="block text-xs text-muted-foreground">{payment.payer_phone}</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{formatPrice(payment.amount)}</TableCell>
                    <TableCell className="hidden font-mono text-xs lg:table-cell">{payment.transaction_reference ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <PaymentStatusBadge status={payment.status} />
                        {payment.requires_refund && <Badge variant="destructive">À rembourser</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {payment.status === 'paid' && can('payments.refund') && (
                        <Button variant="outline" size="sm" onClick={() => askRefund(payment)}>
                          <Undo2 aria-hidden="true" />
                          Rembourser
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination meta={payments.data.meta} onPageChange={filters.setPage} />
        </div>
      )}

      <ConfirmDialog request={confirm} pending={refund.isPending} onClose={() => setConfirm(null)} />
    </div>
  )
}
