import { AlertTriangle, ArrowRight, Bus, CalendarClock, CalendarDays, FileClock, Ticket, Users, Wallet } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/common/page-header'
import { StatCard } from '@/components/common/stat-card'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AgencySelect } from '@/features/agency/agency-select'
import { useDashboard } from '@/features/agency/queries'
import { AGENCY_SECTIONS } from '@/features/agency/sections'
import { useCan } from '@/features/agency/session'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { getErrorMessage } from '@/lib/api-error'
import { firstName, formatDate, formatPrice } from '@/lib/format'
import { useSession } from '@/store/auth-store'
import type { RoleName } from '@/types/api'

/** Sous-titre d'accueil selon le rôle. */
const ROLE_SUBTITLES: Partial<Record<RoleName, string>> = {
  director: 'Vue d’ensemble de vos agences et de leur activité.',
  agency_manager: 'Activité de votre agence pour les prochains jours.',
  counter_clerk: 'Départs et réservations à traiter au guichet.',
  accountant: 'Suivi des encaissements et des remboursements.',
  driver: 'Vos prochains départs et les véhicules de l’agence.',
}

/** Raccourcis vers les sections du quotidien (hors tableau de bord). */
const SECTION_HINTS: Record<string, string> = {
  trips: 'Planifier et publier les départs',
  reservations: 'Retrouver une réservation par référence',
  vehicles: 'Flotte, capacités et maintenance',
  employees: 'Comptes et rôles du personnel',
  payments: 'Encaissements et remboursements',
  settings: 'Coordonnées et présentation publique',
}

function QuickLinks() {
  const can = useCan()
  const sections = AGENCY_SECTIONS.filter((section) => section.path !== 'dashboard' && section.permissions.some(can))

  if (sections.length === 0) return null

  return (
    <section aria-labelledby="quick-links" className="grid gap-3">
      <h2 id="quick-links" className="text-base font-semibold">
        Accès rapides
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map(({ path, label, icon: Icon }) => (
          <Link
            key={path}
            to={`/agency/${path}`}
            className="group flex items-center gap-3 rounded-xl border bg-card p-4 shadow-card transition-shadow outline-none hover:shadow-card-hover focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{label}</span>
              <span className="block truncate text-xs text-muted-foreground">{SECTION_HINTS[path]}</span>
            </span>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  )
}

function FillRate({ reserved, capacity }: { reserved: number; capacity: number }) {
  const percent = capacity > 0 ? Math.round((reserved / capacity) * 100) : 0

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 w-24 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-valuenow={reserved}
        aria-label={`${reserved} places réservées sur ${capacity}`}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-sm tabular-nums">
        {reserved}/{capacity}
      </span>
    </div>
  )
}

/**
 * Tableau de bord agence (/agency/dashboard) : indicateurs du périmètre de l'utilisateur.
 */
export function AgencyDashboardPage() {
  const filters = useUrlFilters()
  const agencyId = filters.getNumber('agency_id')
  const dashboard = useDashboard(agencyId)
  const can = useCan()
  const user = useSession('agency')?.user

  return (
    <div className="grid gap-6">
      <PageHeader
        title={user ? `Bonjour, ${firstName(user.name)}` : 'Tableau de bord'}
        description={(user?.role && ROLE_SUBTITLES[user.role]) ?? 'Activité des prochains jours.'}
        actions={<AgencySelect value={agencyId} onChange={(value) => filters.set('agency_id', value)} />}
      />

      {dashboard.isPending && <LoadingState rows={3} />}
      {dashboard.isError && <ErrorState message={getErrorMessage(dashboard.error)} onRetry={() => dashboard.refetch()} />}

      {dashboard.data && (
        <>
          {dashboard.data.payments && dashboard.data.payments.requires_refund > 0 && (
            <Alert>
              <AlertTriangle aria-hidden="true" />
              <AlertTitle>{dashboard.data.payments.requires_refund} paiement(s) à rembourser</AlertTitle>
              <AlertDescription>
                Paiements encaissés pour des réservations annulées ou expirées.{' '}
                <Link to="/agency/payments?requires_refund=1" className="font-medium underline">
                  Voir les paiements
                </Link>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Départs aujourd'hui" value={dashboard.data.trips.today} icon={CalendarDays} />
            <StatCard label="Départs publiés (7 jours)" value={dashboard.data.trips.published_next_7_days} icon={CalendarClock} tone="info" />
            <StatCard label="Brouillons à venir" value={dashboard.data.trips.drafts} hint="Non visibles du public" icon={FileClock} tone="warning" />
            {dashboard.data.reservations && (
              <StatCard
                label="Passagers confirmés à venir"
                value={dashboard.data.reservations.passengers_upcoming}
                hint={`${dashboard.data.reservations.pending} réservation(s) en attente de paiement`}
                icon={Users}
              />
            )}
            {dashboard.data.reservations && (
              <StatCard
                label="Réservations confirmées (7 jours)"
                value={dashboard.data.reservations.confirmed_last_7_days}
                icon={Ticket}
                tone="success"
              />
            )}
            {dashboard.data.payments && (
              <StatCard
                label="Encaissé ce mois-ci"
                value={formatPrice(dashboard.data.payments.paid_this_month_amount)}
                hint={`${dashboard.data.payments.paid_this_month_count} paiement(s)`}
                icon={Wallet}
                tone="success"
              />
            )}
            {dashboard.data.fleet && (
              <StatCard
                label="Véhicules en service"
                value={dashboard.data.fleet.active}
                hint={`${dashboard.data.fleet.maintenance} en maintenance`}
                icon={Bus}
                tone="info"
              />
            )}
          </div>

          <QuickLinks />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Prochains départs</CardTitle>
              {can('trips.view') && (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/agency/trips">Tous les trajets</Link>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {dashboard.data.next_departures.length === 0 ? (
                <EmptyState title="Aucun départ publié à venir." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Départ</TableHead>
                      <TableHead>Trajet</TableHead>
                      <TableHead className="hidden md:table-cell">Classe</TableHead>
                      <TableHead className="hidden md:table-cell">Agence</TableHead>
                      <TableHead>Remplissage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard.data.next_departures.map((trip) => (
                      <TableRow key={trip.id}>
                        <TableCell className="whitespace-nowrap">
                          <span className="font-medium">{trip.departure_time}</span>
                          <span className="block text-xs text-muted-foreground">{formatDate(trip.departure_date, 'short')}</span>
                        </TableCell>
                        <TableCell>
                          {trip.departure_city} → {trip.destination_city}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{trip.travel_class}</TableCell>
                        <TableCell className="hidden md:table-cell">{trip.agency}</TableCell>
                        <TableCell>
                          <FillRate reserved={trip.reserved_seats} capacity={trip.capacity} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
