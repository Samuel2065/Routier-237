import { Pencil, Plus, Users } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/common/page-header'
import { Pagination } from '@/components/common/pagination'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { EmployeeStatusBadge } from '@/components/common/status-badges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AgencySelect } from '@/features/agency/agency-select'
import { EmployeeFormSheet } from '@/features/agency/employees/employee-form-sheet'
import { useEmployees } from '@/features/agency/queries'
import { useCan } from '@/features/agency/session'
import { useDebouncedCallback } from '@/hooks/use-debounced-callback'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { getErrorMessage } from '@/lib/api-error'
import { formatDate } from '@/lib/format'
import { EMPLOYEE_STATUS_LABELS, ROLE_LABELS } from '@/lib/labels'
import { useSession } from '@/store/auth-store'
import type { Employee, EmployeeStatus, RoleName } from '@/types/api'

const ALL = 'all'
const ROLES: RoleName[] = ['director', 'agency_manager', 'counter_clerk', 'accountant', 'driver']
const STATUSES: EmployeeStatus[] = ['active', 'suspended', 'terminated']

/**
 * Personnel des agences (/agency/employees), conducteurs compris.
 */
export function AgencyEmployeesPage() {
  const filters = useUrlFilters()
  const setSearch = useDebouncedCallback((value: string) => filters.set('search', value.trim()))
  const can = useCan()
  const session = useSession('agency')
  const assignable = session?.user.assignable_roles ?? []
  const role = ROLES.find((value) => value === filters.get('role'))
  const status = STATUSES.find((value) => value === filters.get('status'))
  const employees = useEmployees({
    agency_id: filters.getNumber('agency_id'),
    role,
    status,
    search: filters.get('search'),
    page: filters.page,
  })

  const [editing, setEditing] = useState<Employee | undefined>()
  const [formOpen, setFormOpen] = useState(false)

  const openForm = (employee?: Employee) => {
    setEditing(employee)
    setFormOpen(true)
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Personnel"
        description="Comptes du personnel des agences et permis des conducteurs."
        actions={
          can('employees.create') && assignable.length > 0 && (
            <Button onClick={() => openForm()}>
              <Plus aria-hidden="true" />
              Nouveau membre
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-end gap-3" role="search" aria-label="Filtrer le personnel">
        <AgencySelect value={filters.getNumber('agency_id')} onChange={(value) => filters.set('agency_id', value)} />
        <div className="grid gap-1.5">
          <Label htmlFor="employee-search">Recherche</Label>
          <Input
            id="employee-search"
            className="w-52"
            placeholder="Nom, e-mail, matricule…"
            defaultValue={filters.get('search') ?? ''}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="employee-role-filter">Rôle</Label>
          <Select value={role ?? ALL} onValueChange={(value) => filters.set('role', value === ALL ? undefined : value)}>
            <SelectTrigger id="employee-role-filter" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous</SelectItem>
              {ROLES.filter((value) => value !== 'director').map((value) => (
                <SelectItem key={value} value={value}>
                  {ROLE_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="employee-status-filter">Statut</Label>
          <Select value={status ?? ALL} onValueChange={(value) => filters.set('status', value === ALL ? undefined : value)}>
            <SelectTrigger id="employee-status-filter" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous</SelectItem>
              {STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {EMPLOYEE_STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {employees.isPending && <LoadingState rows={4} />}
      {employees.isError && <ErrorState message={getErrorMessage(employees.error)} onRetry={() => employees.refetch()} />}
      {employees.data && employees.data.data.length === 0 && (
        <EmptyState icon={<Users className="size-8 text-muted-foreground" aria-hidden="true" />} title="Aucun membre du personnel pour ces critères." />
      )}

      {employees.data && employees.data.data.length > 0 && (
        <div className="grid gap-4">
          <div className="overflow-x-auto rounded-xl border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead className="hidden md:table-cell">Matricule</TableHead>
                  <TableHead className="hidden lg:table-cell">Permis</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.data.data.map((employee) => {
                  const manageable = can('employees.update') && employee.role !== null && assignable.includes(employee.role)

                  return (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <span className="font-medium">{employee.user.name}</span>
                        <span className="block text-xs text-muted-foreground">{employee.user.email}</span>
                      </TableCell>
                      <TableCell>
                        {employee.role ? ROLE_LABELS[employee.role] : '—'}
                        <span className="block text-xs text-muted-foreground">{employee.agency.name}</span>
                      </TableCell>
                      <TableCell className="hidden font-mono text-sm md:table-cell">{employee.employee_number}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {employee.driver_profile ? (
                          <span className="flex flex-wrap items-center gap-1.5 text-sm">
                            {employee.driver_profile.license_number}
                            {employee.driver_profile.license_expired ? (
                              <Badge variant="destructive">Expiré</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">jusqu'au {formatDate(employee.driver_profile.license_expires_at, 'short')}</span>
                            )}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <EmployeeStatusBadge status={employee.status} />
                      </TableCell>
                      <TableCell>
                        {manageable && (
                          <Button variant="ghost" size="icon-sm" onClick={() => openForm(employee)} aria-label={`Modifier ${employee.user.name}`}>
                            <Pencil aria-hidden="true" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <Pagination meta={employees.data.meta} onPageChange={filters.setPage} />
        </div>
      )}

      <EmployeeFormSheet open={formOpen} onOpenChange={setFormOpen} employee={editing} />
    </div>
  )
}
