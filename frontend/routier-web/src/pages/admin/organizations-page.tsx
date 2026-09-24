import { ChevronRight, Landmark, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PageHeader } from '@/components/common/page-header'
import { Pagination } from '@/components/common/pagination'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { RecordStatusBadge } from '@/components/common/status-badges'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CreateOrganizationSheet } from '@/features/admin/organization-forms'
import { useOrganizations } from '@/features/admin/queries'
import { useDebouncedCallback } from '@/hooks/use-debounced-callback'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { getErrorMessage } from '@/lib/api-error'

const ALL = 'all'

/**
 * Organisations (entreprises de transport) de la plateforme (/admin/organizations).
 */
export function AdminOrganizationsPage() {
  const filters = useUrlFilters()
  const navigate = useNavigate()
  const status = filters.get('status') === 'active' || filters.get('status') === 'inactive' ? filters.get('status') : undefined
  const organizations = useOrganizations({ status, search: filters.get('search'), page: filters.page })
  const setSearch = useDebouncedCallback((value: string) => filters.set('search', value.trim()))
  const [creating, setCreating] = useState(false)

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Organisations"
        description="Entreprises de transport utilisant Routier+237."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            Nouvelle organisation
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3" role="search" aria-label="Filtrer les organisations">
        <div className="grid gap-1.5">
          <Label htmlFor="organization-search">Nom</Label>
          <Input id="organization-search" className="w-56" placeholder="Rechercher…" defaultValue={filters.get('search') ?? ''} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="organization-status">Statut</Label>
          <Select value={status ?? ALL} onValueChange={(value) => filters.set('status', value === ALL ? undefined : value)}>
            <SelectTrigger id="organization-status" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes</SelectItem>
              <SelectItem value="active">Actives</SelectItem>
              <SelectItem value="inactive">Suspendues</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {organizations.isPending && <LoadingState rows={3} />}
      {organizations.isError && <ErrorState message={getErrorMessage(organizations.error)} onRetry={() => organizations.refetch()} />}
      {organizations.data && organizations.data.data.length === 0 && (
        <EmptyState icon={<Landmark className="size-8 text-muted-foreground" aria-hidden="true" />} title="Aucune organisation pour ces critères." />
      )}

      {organizations.data && organizations.data.data.length > 0 && (
        <div className="grid gap-4">
          <div className="overflow-x-auto rounded-xl border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organisation</TableHead>
                  <TableHead className="hidden md:table-cell">Contact</TableHead>
                  <TableHead>Agences</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Détail</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.data.data.map((organization) => (
                  <TableRow key={organization.id}>
                    <TableCell>
                      <Link to={`/admin/organizations/${organization.id}`} className="font-medium underline-offset-4 hover:underline">
                        {organization.name}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{organization.email ?? organization.phone ?? '—'}</TableCell>
                    <TableCell className="tabular-nums">{organization.agencies_count ?? 0}</TableCell>
                    <TableCell>
                      <RecordStatusBadge status={organization.status} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-sm" asChild>
                        <Link to={`/admin/organizations/${organization.id}`} aria-label={`Ouvrir ${organization.name}`}>
                          <ChevronRight aria-hidden="true" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination meta={organizations.data.meta} onPageChange={filters.setPage} />
        </div>
      )}

      <CreateOrganizationSheet
        open={creating}
        onOpenChange={setCreating}
        onCreated={(organization) => {
          setCreating(false)
          navigate(`/admin/organizations/${organization.id}`)
        }}
      />
    </div>
  )
}
