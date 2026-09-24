import { Building2, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { CitySelect } from '@/components/common/city-select'
import { PageHeader } from '@/components/common/page-header'
import { Pagination } from '@/components/common/pagination'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { RecordStatusBadge } from '@/components/common/status-badges'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AgencyFormSheet } from '@/features/agency/settings/agency-form-sheet'
import { useAdminAgencies, useOrganizations, useSaveAdminAgency } from '@/features/admin/queries'
import { useCities } from '@/features/trips/queries'
import { useDebouncedCallback } from '@/hooks/use-debounced-callback'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { getErrorMessage } from '@/lib/api-error'
import type { ManagedAgency } from '@/types/api'

const ALL = 'all'

/**
 * Supervision des agences de toutes les organisations (/admin/agencies).
 */
export function AdminAgenciesPage() {
  const filters = useUrlFilters()
  const status = filters.get('status') === 'active' || filters.get('status') === 'inactive' ? filters.get('status') : undefined
  const agencies = useAdminAgencies({
    organization_id: filters.getNumber('organization_id'),
    city_id: filters.getNumber('city_id'),
    status,
    search: filters.get('search'),
    page: filters.page,
  })
  const organizations = useOrganizations({ per_page: 100 })
  const cities = useCities()
  const saveAgency = useSaveAdminAgency()
  const setSearch = useDebouncedCallback((value: string) => filters.set('search', value.trim()))

  const [editing, setEditing] = useState<ManagedAgency | undefined>()
  const [formOpen, setFormOpen] = useState(false)
  const organizationOptions = organizations.data?.data.map(({ id, name }) => ({ id, name })) ?? []

  const openForm = (agency?: ManagedAgency) => {
    setEditing(agency)
    setFormOpen(true)
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Agences"
        description="Toutes les agences, toutes organisations confondues."
        actions={
          <Button onClick={() => openForm()} disabled={organizationOptions.length === 0}>
            <Plus aria-hidden="true" />
            Nouvelle agence
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3" role="search" aria-label="Filtrer les agences">
        <div className="grid gap-1.5">
          <Label htmlFor="agency-search">Nom</Label>
          <Input id="agency-search" className="w-48" placeholder="Rechercher…" defaultValue={filters.get('search') ?? ''} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="agency-organization-filter">Organisation</Label>
          <Select
            value={filters.get('organization_id') ?? ALL}
            onValueChange={(value) => filters.set('organization_id', value === ALL ? undefined : value)}
          >
            <SelectTrigger id="agency-organization-filter" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes</SelectItem>
              {organizationOptions.map((organization) => (
                <SelectItem key={organization.id} value={String(organization.id)}>
                  {organization.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid w-44 gap-1.5">
          <Label htmlFor="agency-city-filter">Ville</Label>
          <CitySelect id="agency-city-filter" cities={cities.data ?? []} value={filters.getNumber('city_id')} onChange={(value) => filters.set('city_id', value)} placeholder="Toutes" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="agency-status-filter">Statut</Label>
          <Select value={status ?? ALL} onValueChange={(value) => filters.set('status', value === ALL ? undefined : value)}>
            <SelectTrigger id="agency-status-filter" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous</SelectItem>
              <SelectItem value="active">Actives</SelectItem>
              <SelectItem value="inactive">Inactives</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {filters.getNumber('city_id') && (
          <Button variant="ghost" size="sm" onClick={() => filters.set('city_id', undefined)}>
            Toutes les villes
          </Button>
        )}
      </div>

      {agencies.isPending && <LoadingState rows={3} />}
      {agencies.isError && <ErrorState message={getErrorMessage(agencies.error)} onRetry={() => agencies.refetch()} />}
      {agencies.data && agencies.data.data.length === 0 && (
        <EmptyState icon={<Building2 className="size-8 text-muted-foreground" aria-hidden="true" />} title="Aucune agence pour ces critères." />
      )}

      {agencies.data && agencies.data.data.length > 0 && (
        <div className="grid gap-4">
          <div className="overflow-x-auto rounded-xl border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agence</TableHead>
                  <TableHead>Organisation</TableHead>
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
                    <TableCell>
                      {agency.organization && (
                        <Link to={`/admin/organizations/${agency.organization.id}`} className="underline-offset-4 hover:underline">
                          {agency.organization.name}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell>{agency.city?.name}</TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">{agency.employees_count ?? '—'}</TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">{agency.vehicles_count ?? '—'}</TableCell>
                    <TableCell>
                      <RecordStatusBadge status={agency.status} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-sm" onClick={() => openForm(agency)} aria-label={`Modifier ${agency.name}`}>
                        <Pencil aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination meta={agencies.data.meta} onPageChange={filters.setPage} />
        </div>
      )}

      <AgencyFormSheet open={formOpen} onOpenChange={setFormOpen} agency={editing} save={saveAgency} organizations={organizationOptions} />
    </div>
  )
}
