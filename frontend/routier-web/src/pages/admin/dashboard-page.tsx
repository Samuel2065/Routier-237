import { AlertTriangle, Building2, CalendarClock, Landmark, Ticket, UserRoundX, UsersRound, Wallet } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/common/page-header'
import { StatCard } from '@/components/common/stat-card'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { UserAvatar } from '@/components/common/user-avatar'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAdminDashboard } from '@/features/admin/queries'
import { getErrorMessage } from '@/lib/api-error'
import { firstName, formatPrice } from '@/lib/format'
import { ROLE_LABELS } from '@/lib/labels'
import { useSession } from '@/store/auth-store'
import type { AdminDashboard } from '@/types/api'

/** « à l'instant », « il y a 5 min ». */
function lastActivity(iso: string, now: number = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000)
  return minutes < 1 ? 'Actif à l’instant' : `Actif il y a ${minutes} min`
}

function ActiveStaffCard({ activeStaff }: { activeStaff: AdminDashboard['active_staff'] }) {
  const hidden = activeStaff.count - activeStaff.users.length

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="grid gap-1">
          <CardTitle>Personnel actif</CardTitle>
          <CardDescription>Personnel des agences connecté au cours des {activeStaff.window_minutes} dernières minutes.</CardDescription>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-700">
          <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
          {activeStaff.count} en ligne
        </span>
      </CardHeader>
      <CardContent>
        {activeStaff.users.length === 0 ? (
          <EmptyState
            icon={<UsersRound className="size-8 text-muted-foreground" aria-hidden="true" />}
            title={`Aucun membre du personnel actif dans les ${activeStaff.window_minutes} dernières minutes.`}
          />
        ) : (
          <ul className="grid gap-1" aria-label="Personnel actif">
            {activeStaff.users.map((member) => (
              <li key={member.id} className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/60">
                <span className="relative">
                  <UserAvatar name={member.name} src={member.avatar_url} />
                  <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full bg-emerald-500 ring-2 ring-card" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{member.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[member.role ? ROLE_LABELS[member.role] : null, member.agency ?? member.organization].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{lastActivity(member.last_active_at)}</span>
              </li>
            ))}
          </ul>
        )}
        {hidden > 0 && <p className="mt-3 text-xs text-muted-foreground">Et {hidden} autre(s) membre(s) du personnel actif(s).</p>}
      </CardContent>
    </Card>
  )
}

/**
 * Supervision de la plateforme (/admin/dashboard).
 */
export function AdminDashboardPage() {
  const dashboard = useAdminDashboard()
  const data = dashboard.data
  const user = useSession('admin')?.user

  return (
    <div className="grid gap-6">
      <PageHeader
        title={user ? `Bienvenue, ${firstName(user.name)}` : 'Supervision'}
        description="Supervision de toutes les organisations, agences et comptes de la plateforme."
      />

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
            <StatCard label="Clients inscrits" value={data.users.customers} icon={UsersRound} tone="info" />
            <StatCard label="Personnel des agences" value={data.users.staff} icon={UsersRound} tone="info" />
            <StatCard label="Comptes suspendus" value={data.users.suspended} hint={<Link to="/admin/users?status=suspended" className="underline">Voir</Link>} icon={UserRoundX} tone="danger" />
            <StatCard label="Départs publiés (7 jours)" value={data.trips.published_next_7_days} icon={CalendarClock} tone="info" />
            <StatCard
              label="Réservations confirmées (30 jours)"
              value={data.reservations.confirmed_last_30_days}
              hint={`${data.reservations.pending} en attente de paiement`}
              icon={Ticket}
              tone="success"
            />
            <StatCard label="Encaissé ce mois-ci" value={formatPrice(data.payments.paid_this_month_amount)} icon={Wallet} tone="success" />
          </div>

          <ActiveStaffCard activeStaff={data.active_staff} />
        </>
      )}
    </div>
  )
}
