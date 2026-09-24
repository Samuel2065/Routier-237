import { ArrowLeft, Ban, Pencil, Plus, RotateCcw, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog, type ConfirmRequest } from '@/components/common/confirm-dialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { RecordStatusBadge } from '@/components/common/status-badges'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AgencyFormSheet } from '@/features/agency/settings/agency-form-sheet'
import { OrganizationForm } from '@/features/agency/settings/contact-forms'
import { CreateDirectorSheet } from '@/features/admin/organization-forms'
import { useAdminOrganization, useSaveAdminAgency, useSaveOrganization } from '@/features/admin/queries'
import { getErrorMessage, getStatus } from '@/lib/api-error'
import type { ManagedAgency } from '@/types/api'

/**
 * Détail d'une organisation (/admin/organizations/:id) : profil, suspension,
 * agences et directeurs.
 */
export function AdminOrganizationDetailPage() {
  const { id } = useParams()
  const organizationId = Number(id)
  const organization = useAdminOrganization(organizationId)
  const saveOrganization = useSaveOrganization()
  const saveAgency = useSaveAdminAgency()

  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [directorOpen, setDirectorOpen] = useState(false)
  const [agencyOpen, setAgencyOpen] = useState(false)
  const [editingAgency, setEditingAgency] = useState<ManagedAgency | undefined>()

  if (organization.isPending) return <LoadingState rows={3} />
  if (organization.isError) {
    return getStatus(organization.error) === 404 ? (
      <EmptyState title="Organisation introuvable" action={<Button asChild><Link to="/admin/organizations">Retour aux organisations</Link></Button>} />
    ) : (
      <ErrorState message={getErrorMessage(organization.error)} onRetry={() => organization.refetch()} />
    )
  }

  const data = organization.data
  const active = data.status === 'active'

  const askStatusChange = () =>
    setConfirm({
      title: active ? `Suspendre ${data.name} ?` : `Réactiver ${data.name} ?`,
      description: active
        ? "Son personnel perd immédiatement l'accès à l'espace agence et ses agences disparaissent de la recherche publique."
        : 'Son personnel retrouve son accès et ses agences actives redeviennent visibles.',
      confirmLabel: active ? 'Suspendre' : 'Réactiver',
      destructive: active,
      onConfirm: () =>
        saveOrganization.mutate(
          { id: data.id, input: { status: active ? 'inactive' : 'active' } },
          {
            onSuccess: () => toast.success(active ? 'Organisation suspendue.' : 'Organisation réactivée.'),
            onError: (error) => toast.error(getErrorMessage(error)),
            onSettled: () => setConfirm(null),
          },
        ),
    })

  const openAgency = (agency?: ManagedAgency) => {
    setEditingAgency(agency)
    setAgencyOpen(true)
  }

  return (
    <div className="grid gap-6">
      <Button variant="ghost" className="w-fit" asChild>
        <Link to="/admin/organizations">
          <ArrowLeft aria-hidden="true" />
          Organisations
        </Link>
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
          <RecordStatusBadge status={data.status} />
        </div>
        <Button variant={active ? 'destructive' : 'default'} onClick={askStatusChange}>
          {active ? <Ban aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
          {active ? "Suspendre l'organisation" : "Réactiver l'organisation"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="grid gap-1">
              <CardTitle>Agences ({data.agencies?.length ?? 0})</CardTitle>
              <CardDescription>Plusieurs agences possibles, y compris dans une même ville.</CardDescription>
            </div>
            <Button size="sm" onClick={() => openAgency()}>
              <Plus aria-hidden="true" />
              Nouvelle agence
            </Button>
          </CardHeader>
          <CardContent>
            {data.agencies && data.agencies.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agence</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.agencies.map((agency) => (
                    <TableRow key={agency.id}>
                      <TableCell className="font-medium">{agency.name}</TableCell>
                      <TableCell>{agency.city?.name}</TableCell>
                      <TableCell>
                        <RecordStatusBadge status={agency.status} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon-sm" onClick={() => openAgency(agency)} aria-label={`Modifier ${agency.name}`}>
                          <Pencil aria-hidden="true" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title="Aucune agence pour le moment." />
            )}
          </CardContent>
        </Card>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <CardTitle>Directeurs</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setDirectorOpen(true)}>
                <UserPlus aria-hidden="true" />
                Ajouter
              </Button>
            </CardHeader>
            <CardContent>
              {data.directors && data.directors.length > 0 ? (
                <ul className="grid gap-2 text-sm">
                  {data.directors.map((director) => (
                    <li key={director.id} className="grid">
                      <span className="font-medium">{director.name}</span>
                      <span className="text-muted-foreground">{director.email}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun directeur : créez-en un pour que l'organisation gère ses agences.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profil</CardTitle>
            </CardHeader>
            <CardContent>
              <OrganizationForm key={data.updated_at ?? data.id} organization={data} save={saveOrganization} />
            </CardContent>
          </Card>
        </div>
      </div>

      <AgencyFormSheet
        open={agencyOpen}
        onOpenChange={setAgencyOpen}
        agency={editingAgency}
        save={saveAgency}
        organizations={[{ id: data.id, name: data.name }]}
      />
      <CreateDirectorSheet organization={data} open={directorOpen} onOpenChange={setDirectorOpen} />
      <ConfirmDialog request={confirm} pending={saveOrganization.isPending} onClose={() => setConfirm(null)} />
    </div>
  )
}
