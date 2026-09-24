import { AlertTriangle, Building2, CalendarClock, Landmark, Ticket, UserRoundX, UsersRound, Wallet } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/common/page-header'
import { StatCard } from '@/components/common/stat-card'
import { ErrorState, LoadingState } from '@/components/common/states'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useAdminDashboard } from '@/features/admin/queries'
import { getErrorMessage } from '@/lib/api-error'
import { formatPrice } from '@/lib/format'

/**
 * Supervision de la plateforme (/admin/dashboard).
 */
export function AdminDashboardPage() {
  const dashboard = useAdminDashboard()
  const data = dashboard.data

  return (
    <div className="grid gap-6">
      <PageHeader title="Supervision" description="Vue d'ensemble de toutes les organisations." />

      {dashboard.isPending && <LoadingState rows={3} />}
      {dashboard.isError && <ErrorState message={getErrorMessage(dashboard.error)} onRetry={() => dashboard.refetch()} />}

      {data && (
        <>
          {data.payments.requires_refund > 0 && (
            <Alert>
              <AlertTriangle aria-hidden="true" />
              <AlertTitle>{data.payments.requires_refund} paiement(s) en attente de remboursement</AlertTitle>
              <AlertDescription>Les agences concernées les voient dans leur espace (Paiements, « à rembourser »).</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Organisations actives" value={data.organizations.active} hint={`${data.organizations.inactive} suspendue(s)`} icon={Landmark} />
            <StatCard label="Agences actives" value={data.agencies.active} hint={`${data.agencies.inactive} inactive(s)`} icon={Building2} />
            <StatCard label="Clients inscrits" value={data.users.customers} icon={UsersRound} />
            <StatCard label="Personnel des agences" value={data.users.staff} icon={UsersRound} />
            <StatCard label="Comptes suspendus" value={data.users.suspended} hint={<Link to="/admin/users?status=suspended" className="underline">Voir</Link>} icon={UserRoundX} />
            <StatCard label="Départs publiés (7 jours)" value={data.trips.published_next_7_days} icon={CalendarClock} />
            <StatCard
              label="Réservations confirmées (30 jours)"
              value={data.reservations.confirmed_last_30_days}
              hint={`${data.reservations.pending} en attente de paiement`}
              icon={Ticket}
            />
            <StatCard label="Encaissé ce mois-ci" value={formatPrice(data.payments.paid_this_month_amount)} icon={Wallet} />
          </div>
        </>
      )}
    </div>
  )
}
