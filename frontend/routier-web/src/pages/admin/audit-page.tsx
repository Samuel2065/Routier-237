import { ScrollText } from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { Pagination } from '@/components/common/pagination'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AUDIT_CATEGORIES, auditActionLabel, auditDetails } from '@/features/admin/audit-labels'
import { useAuditLogs } from '@/features/admin/queries'
import { useDebouncedCallback } from '@/hooks/use-debounced-callback'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { getErrorMessage } from '@/lib/api-error'
import { formatDateTime } from '@/lib/format'
import { ROLE_LABELS } from '@/lib/labels'

const ALL = 'all'

/**
 * Journal d'audit (/admin/audit) : actions sensibles de la plateforme, en lecture seule.
 * Aucun mot de passe, jeton ni secret n'y est enregistré.
 */
export function AdminAuditPage() {
  const filters = useUrlFilters()
  const logs = useAuditLogs({
    action: filters.get('action'),
    search: filters.get('search'),
    date_from: filters.get('date_from'),
    date_to: filters.get('date_to'),
    page: filters.page,
  })
  const setSearch = useDebouncedCallback((value: string) => filters.set('search', value.trim()))

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Journal d'audit"
        description="Qui a fait quoi et quand : suspensions, créations, réinitialisations de mot de passe, annulations et remboursements. Les entrées ne peuvent être ni modifiées ni supprimées."
      />

      <div className="flex flex-wrap items-end gap-3" role="search" aria-label="Filtrer le journal d'audit">
        <div className="grid gap-1.5">
          <Label htmlFor="audit-category">Catégorie</Label>
          <Select value={filters.get('action') ?? ALL} onValueChange={(value) => filters.set('action', value === ALL ? undefined : value)}>
            <SelectTrigger id="audit-category" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes</SelectItem>
              {AUDIT_CATEGORIES.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="audit-search">Recherche</Label>
          <Input id="audit-search" className="w-56" placeholder="Auteur, compte, référence…" defaultValue={filters.get('search') ?? ''} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="audit-from">Du</Label>
          <Input id="audit-from" type="date" className="w-40" value={filters.get('date_from') ?? ''} onChange={(event) => filters.set('date_from', event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="audit-to">au</Label>
          <Input id="audit-to" type="date" className="w-40" value={filters.get('date_to') ?? ''} onChange={(event) => filters.set('date_to', event.target.value)} />
        </div>
      </div>

      {logs.isPending && <LoadingState rows={4} />}
      {logs.isError && <ErrorState message={getErrorMessage(logs.error)} onRetry={() => logs.refetch()} />}
      {logs.data && logs.data.data.length === 0 && (
        <EmptyState icon={<ScrollText className="size-8 text-muted-foreground" aria-hidden="true" />} title="Aucune action enregistrée pour ces critères." />
      )}

      {logs.data && logs.data.data.length > 0 && (
        <div className="grid gap-4">
          <div className="overflow-x-auto rounded-xl border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Auteur</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Élément</TableHead>
                  <TableHead className="hidden lg:table-cell">Détails</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.data.data.map((entry) => {
                  const details = auditDetails(entry)

                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDateTime(entry.created_at)}
                        {entry.ip_address && <span className="block text-xs text-muted-foreground">IP {entry.ip_address}</span>}
                      </TableCell>
                      <TableCell className="text-sm">
                        {entry.actor?.name ?? 'Système / visiteur'}
                        {entry.actor?.role && <span className="block text-xs text-muted-foreground">{ROLE_LABELS[entry.actor.role]}</span>}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{auditActionLabel(entry.action)}</TableCell>
                      <TableCell className="text-sm">{entry.subject?.label ?? '—'}</TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                        {details.length > 0 ? details.map((detail) => <span key={detail} className="block">{detail}</span>) : '—'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <Pagination meta={logs.data.meta} onPageChange={filters.setPage} />
        </div>
      )}
    </div>
  )
}
