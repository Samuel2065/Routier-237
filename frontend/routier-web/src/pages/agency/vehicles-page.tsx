import { Bus, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog, type ConfirmRequest } from '@/components/common/confirm-dialog'
import { PageHeader } from '@/components/common/page-header'
import { Pagination } from '@/components/common/pagination'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { VehicleStatusBadge } from '@/components/common/status-badges'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AgencySelect } from '@/features/agency/agency-select'
import { useDeleteVehicle, useVehicles } from '@/features/agency/queries'
import { useCan } from '@/features/agency/session'
import { VehicleFormSheet } from '@/features/agency/vehicles/vehicle-form-sheet'
import { useTravelClasses } from '@/features/trips/queries'
import { useDebouncedCallback } from '@/hooks/use-debounced-callback'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { getErrorMessage } from '@/lib/api-error'
import { VEHICLE_STATUS_LABELS } from '@/lib/labels'
import type { Vehicle, VehicleStatus } from '@/types/api'

const ALL = 'all'
const STATUSES: VehicleStatus[] = ['active', 'maintenance', 'retired']

/**
 * Flotte de l'agence (/agency/vehicles).
 */
export function AgencyVehiclesPage() {
  const filters = useUrlFilters()
  const setSearch = useDebouncedCallback((value: string) => filters.set('search', value.trim()))
  const can = useCan()
  const travelClasses = useTravelClasses()
  const status = STATUSES.find((value) => value === filters.get('status'))
  const vehicles = useVehicles({
    agency_id: filters.getNumber('agency_id'),
    travel_class_id: filters.getNumber('travel_class_id'),
    status,
    search: filters.get('search'),
    page: filters.page,
  })
  const deleteVehicle = useDeleteVehicle()

  const [editing, setEditing] = useState<Vehicle | undefined>()
  // Ouverture directe du formulaire d'ajout (lien « Ajouter un véhicule » du formulaire de trajet).
  const [formOpen, setFormOpen] = useState(() => filters.get('new') === '1' && can('vehicles.create'))
  const [defaultAgencyId] = useState(() => (filters.get('new') === '1' ? filters.getNumber('agency_id') : undefined))
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  const openForm = (vehicle?: Vehicle) => {
    setEditing(vehicle)
    setFormOpen(true)
  }

  const askDelete = (vehicle: Vehicle) =>
    setConfirm({
      title: `Supprimer le véhicule ${vehicle.registration_number} ?`,
      description: "Possible uniquement s'il n'a jamais servi. Un véhicule déjà utilisé se met hors service.",
      confirmLabel: 'Supprimer',
      destructive: true,
      onConfirm: () =>
        deleteVehicle.mutate(vehicle.id, {
          onSuccess: () => toast.success('Véhicule supprimé.'),
          onError: (error) => toast.error(getErrorMessage(error)),
          onSettled: () => setConfirm(null),
        }),
    })

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Véhicules"
        description="Chaque véhicule appartient à une classe et définit la capacité de ses trajets."
        actions={
          can('vehicles.create') && (
            <Button onClick={() => openForm()}>
              <Plus aria-hidden="true" />
              Nouveau véhicule
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-end gap-3" role="search" aria-label="Filtrer les véhicules">
        <AgencySelect value={filters.getNumber('agency_id')} onChange={(value) => filters.set('agency_id', value)} />
        <div className="grid gap-1.5">
          <Label htmlFor="vehicle-search">Immatriculation</Label>
          <Input
            id="vehicle-search"
            className="w-44"
            placeholder="Rechercher…"
            defaultValue={filters.get('search') ?? ''}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="vehicle-class-filter">Classe</Label>
          <Select
            value={filters.get('travel_class_id') ?? ALL}
            onValueChange={(value) => filters.set('travel_class_id', value === ALL ? undefined : value)}
          >
            <SelectTrigger id="vehicle-class-filter" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes</SelectItem>
              {travelClasses.data?.map((travelClass) => (
                <SelectItem key={travelClass.id} value={String(travelClass.id)}>
                  {travelClass.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="vehicle-status-filter">Statut</Label>
          <Select value={status ?? ALL} onValueChange={(value) => filters.set('status', value === ALL ? undefined : value)}>
            <SelectTrigger id="vehicle-status-filter" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous</SelectItem>
              {STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {VEHICLE_STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {vehicles.isPending && <LoadingState rows={4} />}
      {vehicles.isError && <ErrorState message={getErrorMessage(vehicles.error)} onRetry={() => vehicles.refetch()} />}
      {vehicles.data && vehicles.data.data.length === 0 && (
        <EmptyState icon={<Bus className="size-8 text-muted-foreground" aria-hidden="true" />} title="Aucun véhicule pour ces critères." />
      )}

      {vehicles.data && vehicles.data.data.length > 0 && (
        <div className="grid gap-4">
          <div className="overflow-x-auto rounded-xl border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Immatriculation</TableHead>
                  <TableHead>Véhicule</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Capacité</TableHead>
                  <TableHead className="hidden md:table-cell">Trajets à venir</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-24">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.data.data.map((vehicle) => (
                  <TableRow key={vehicle.id}>
                    <TableCell className="font-mono text-sm font-medium">{vehicle.registration_number}</TableCell>
                    <TableCell>
                      {vehicle.brand} {vehicle.model}
                      {vehicle.agency && <span className="block text-xs text-muted-foreground">{vehicle.agency.name}</span>}
                    </TableCell>
                    <TableCell>{vehicle.travel_class?.name}</TableCell>
                    <TableCell className="tabular-nums">{vehicle.capacity}</TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">{vehicle.upcoming_trips_count ?? 0}</TableCell>
                    <TableCell>
                      <VehicleStatusBadge status={vehicle.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {can('vehicles.update') && (
                          <Button variant="ghost" size="icon-sm" onClick={() => openForm(vehicle)} aria-label={`Modifier ${vehicle.registration_number}`}>
                            <Pencil aria-hidden="true" />
                          </Button>
                        )}
                        {can('vehicles.delete') && (
                          <Button variant="ghost" size="icon-sm" onClick={() => askDelete(vehicle)} aria-label={`Supprimer ${vehicle.registration_number}`}>
                            <Trash2 aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination meta={vehicles.data.meta} onPageChange={filters.setPage} />
        </div>
      )}

      <VehicleFormSheet
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open && filters.get('new')) filters.set('new', undefined)
        }}
        vehicle={editing}
        defaultAgencyId={editing ? undefined : defaultAgencyId}
      />
      <ConfirmDialog request={confirm} pending={deleteVehicle.isPending} onClose={() => setConfirm(null)} />
    </div>
  )
}
