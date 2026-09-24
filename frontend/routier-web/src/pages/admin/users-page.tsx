import { Ban, RotateCcw, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog, type ConfirmRequest } from '@/components/common/confirm-dialog'
import { PageHeader } from '@/components/common/page-header'
import { Pagination } from '@/components/common/pagination'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAdminUsers, useUpdateUserStatus } from '@/features/admin/queries'
import { useDebouncedCallback } from '@/hooks/use-debounced-callback'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { getErrorMessage } from '@/lib/api-error'
import { formatDateTime } from '@/lib/format'
import { ROLE_LABELS } from '@/lib/labels'
import { useSession } from '@/store/auth-store'
import type { AdminUser, RoleName } from '@/types/api'

const ALL = 'all'
const ROLES: RoleName[] = ['customer', 'director', 'agency_manager', 'counter_clerk', 'accountant', 'driver', 'super_admin']

/**
 * Comptes de la plateforme (/admin/users) : consultation et contrôle d'accès.
 */
export function AdminUsersPage() {
  const filters = useUrlFilters()
  const session = useSession('admin')
  const role = ROLES.find((value) => value === filters.get('role'))
  const status = filters.get('status') === 'active' || filters.get('status') === 'suspended' ? filters.get('status') : undefined
  const users = useAdminUsers({ role, status, search: filters.get('search'), page: filters.page })
  const updateStatus = useUpdateUserStatus()
  const setSearch = useDebouncedCallback((value: string) => filters.set('search', value.trim()))
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  const askStatusChange = (user: AdminUser) => {
    const suspend = user.status === 'active'
    setConfirm({
      title: suspend ? `Suspendre le compte de ${user.name} ?` : `Réactiver le compte de ${user.name} ?`,
      description: suspend ? 'La personne est déconnectée immédiatement et ne peut plus se connecter.' : 'La personne pourra de nouveau se connecter.',
      confirmLabel: suspend ? 'Suspendre' : 'Réactiver',
      destructive: suspend,
      onConfirm: () =>
        updateStatus.mutate(
          { id: user.id, status: suspend ? 'suspended' : 'active' },
          {
            onSuccess: () => toast.success(suspend ? 'Compte suspendu.' : 'Compte réactivé.'),
            onError: (error) => toast.error(getErrorMessage(error)),
            onSettled: () => setConfirm(null),
          },
        ),
    })
  }

  return (
    <div className="grid gap-6">
      <PageHeader title="Utilisateurs" description="Clients et personnel. Les rôles du personnel se gèrent dans l'espace agence de chaque organisation." />

      <div className="flex flex-wrap items-end gap-3" role="search" aria-label="Filtrer les utilisateurs">
        <div className="grid gap-1.5">
          <Label htmlFor="user-search">Recherche</Label>
          <Input id="user-search" className="w-56" placeholder="Nom, e-mail, téléphone…" defaultValue={filters.get('search') ?? ''} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="user-role">Rôle</Label>
          <Select value={role ?? ALL} onValueChange={(value) => filters.set('role', value === ALL ? undefined : value)}>
            <SelectTrigger id="user-role" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous</SelectItem>
              {ROLES.map((value) => (
                <SelectItem key={value} value={value}>
                  {ROLE_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="user-status">Statut</Label>
          <Select value={status ?? ALL} onValueChange={(value) => filters.set('status', value === ALL ? undefined : value)}>
            <SelectTrigger id="user-status" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous</SelectItem>
              <SelectItem value="active">Actifs</SelectItem>
              <SelectItem value="suspended">Suspendus</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {users.isPending && <LoadingState rows={4} />}
      {users.isError && <ErrorState message={getErrorMessage(users.error)} onRetry={() => users.refetch()} />}
      {users.data && users.data.data.length === 0 && (
        <EmptyState icon={<UsersRound className="size-8 text-muted-foreground" aria-hidden="true" />} title="Aucun compte pour ces critères." />
      )}

      {users.data && users.data.data.length > 0 && (
        <div className="grid gap-4">
          <div className="overflow-x-auto rounded-xl border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead className="hidden md:table-cell">Rattachement</TableHead>
                  <TableHead className="hidden lg:table-cell">Inscrit le</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-32">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.data.data.map((user) => {
                  const self = user.id === session?.user.id

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <span className="font-medium">{user.name}</span>
                        <span className="block text-xs text-muted-foreground">{user.email}</span>
                      </TableCell>
                      <TableCell>{user.role ? ROLE_LABELS[user.role] : '—'}</TableCell>
                      <TableCell className="hidden text-sm md:table-cell">
                        {user.agency?.name ?? user.organization?.name ?? '—'}
                        {user.agency && user.organization && <span className="block text-xs text-muted-foreground">{user.organization.name}</span>}
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-sm lg:table-cell">{formatDateTime(user.created_at)}</TableCell>
                      <TableCell>
                        {user.status === 'active' ? (
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                            Actif
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Suspendu</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!self && (
                          <Button variant="outline" size="sm" onClick={() => askStatusChange(user)}>
                            {user.status === 'active' ? <Ban aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
                            {user.status === 'active' ? 'Suspendre' : 'Réactiver'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <Pagination meta={users.data.meta} onPageChange={filters.setPage} />
        </div>
      )}

      <ConfirmDialog request={confirm} pending={updateStatus.isPending} onClose={() => setConfirm(null)} />
    </div>
  )
}
