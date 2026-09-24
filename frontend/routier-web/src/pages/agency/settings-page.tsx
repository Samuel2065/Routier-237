import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/common/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { RecordStatusBadge } from '@/components/common/status-badges'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useManagedAgencies, useOrganization } from '@/features/agency/queries'
import { useCan } from '@/features/agency/session'
import { AgencyFormSheet } from '@/features/agency/settings/agency-form-sheet'
import { AgencySettingsForm, OrganizationForm } from '@/features/agency/settings/contact-forms'
import { getErrorMessage } from '@/lib/api-error'
import { useSession } from '@/store/auth-store'
import type { ManagedAgency } from '@/types/api'

/**
 * Paramètres (/agency/settings) : l'agence pour son responsable ; l'organisation et
 * ses agences pour le director.
 */
export function AgencySettingsPage() {
  const session = useSession('agency')
  const can = useCan()
  const user = session?.user
  const isDirector = !!user && user.agency === null && !!user.organization
  const agencies = useManagedAgencies(can('agencies.view'))
  const organization = useOrganization(isDirector && can('organizations.update') ? user?.organization?.id : undefined)
  const [editing, setEditing] = useState<ManagedAgency | undefined>()
  const [formOpen, setFormOpen] = useState(false)

  const ownAgency = user?.agency ? agencies.data?.data.find((agency) => agency.id === user.agency?.id) : undefined

  const openForm = (agency?: ManagedAgency) => {
    setEditing(agency)
    setFormOpen(true)
  }

  return (
    <div className="grid gap-6">
      <PageHeader title="Paramètres" description={isDirector ? "Votre organisation et ses agences." : 'Coordonnées et présentation de votre agence.'} />

      {!isDirector && can('agency_settings.update') && (
        <Card>
          <CardHeader>
            <CardTitle>{user?.agency?.name}</CardTitle>
            <CardDescription>Le nom, la ville et le statut de l'agence sont gérés par la direction.</CardDescription>
          </CardHeader>
          <CardContent>
            {agencies.isPending && <LoadingState rows={1} />}
            {agencies.isError && <ErrorState message={getErrorMessage(agencies.error)} onRetry={() => agencies.refetch()} />}
            {ownAgency && <AgencySettingsForm agency={ownAgency} />}
          </CardContent>
        </Card>
      )}

      {isDirector && (
        <>
          {can('organizations.update') && (
            <Card>
              <CardHeader>
                <CardTitle>Organisation</CardTitle>
                <CardDescription>Son activation ou sa suspension relève de la plateforme.</CardDescription>
              </CardHeader>
              <CardContent>
                {organization.isPending && <LoadingState rows={1} />}
                {organization.isError && <ErrorState message={getErrorMessage(organization.error)} onRetry={() => organization.refetch()} />}
                {organization.data && <OrganizationForm key={organization.data.id} organization={organization.data} />}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="grid gap-1">
                <CardTitle>Agences</CardTitle>
                <CardDescription>Désactiver une agence la retire de la recherche publique et bloque l'accès de son personnel.</CardDescription>
              </div>
              {can('agencies.create') && (
                <Button size="sm" onClick={() => openForm()}>
                  <Plus aria-hidden="true" />
                  Nouvelle agence
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {agencies.isPending && <LoadingState rows={2} />}
              {agencies.isError && <ErrorState message={getErrorMessage(agencies.error)} onRetry={() => agencies.refetch()} />}
              {agencies.data && agencies.data.data.length === 0 && <EmptyState title="Aucune agence." />}
              {agencies.data && agencies.data.data.length > 0 && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agence</TableHead>
                        <TableHead>Ville</TableHead>
                        <TableHead className="hidden md:table-cell">Personnel</TableHead>
                        <TableHead className="hidden md:table-cell">Véhicules</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="w-12">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agencies.data.data.map((agency) => (
                        <TableRow key={agency.id}>
                          <TableCell className="font-medium">{agency.name}</TableCell>
                          <TableCell>{agency.city?.name}</TableCell>
                          <TableCell className="hidden tabular-nums md:table-cell">{agency.employees_count ?? '—'}</TableCell>
                          <TableCell className="hidden tabular-nums md:table-cell">{agency.vehicles_count ?? '—'}</TableCell>
                          <TableCell>
                            <RecordStatusBadge status={agency.status} />
                          </TableCell>
                          <TableCell>
                            {can('agencies.update') && (
                              <Button variant="ghost" size="icon-sm" onClick={() => openForm(agency)} aria-label={`Modifier ${agency.name}`}>
                                <Pencil aria-hidden="true" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <AgencyFormSheet open={formOpen} onOpenChange={setFormOpen} agency={editing} />
    </div>
  )
}
