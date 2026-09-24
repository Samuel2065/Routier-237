import { Check, Loader2, MapPin, Pencil, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { CitySelect } from '@/components/common/city-select'
import { PageHeader } from '@/components/common/page-header'
import { ErrorState, LoadingState } from '@/components/common/states'
import { RecordStatusBadge } from '@/components/common/status-badges'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAdminRoutes, useSaveAdminRoute, useSaveCity } from '@/features/admin/queries'
import { useCities } from '@/features/trips/queries'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { formatDuration } from '@/lib/format'
import type { City, RecordStatus, RouteRecord } from '@/types/api'

function firstError(error: unknown): string | null {
  return Object.values(getFieldErrors(error))[0] ?? (error ? getErrorMessage(error) : null)
}

/**
 * Villes : ajout et renommage (jamais de suppression : elles sont référencées).
 */
function CitiesCard() {
  const cities = useCities()
  const saveCity = useSaveCity()
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null)

  const add = () =>
    saveCity.mutate(
      { name },
      {
        onSuccess: (city) => {
          toast.success(`Ville « ${city.name} » ajoutée.`)
          setName('')
        },
      },
    )

  const rename = () =>
    editing &&
    saveCity.mutate(
      { id: editing.id, name: editing.name },
      {
        onSuccess: () => {
          toast.success('Ville renommée.')
          setEditing(null)
        },
      },
    )

  const error = saveCity.isError ? firstError(saveCity.error) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Villes</CardTitle>
        <CardDescription>Utilisées par les agences, les itinéraires et la recherche publique.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (name.trim()) add()
          }}
        >
          <Label htmlFor="new-city" className="sr-only">
            Nouvelle ville
          </Label>
          <Input id="new-city" placeholder="Nouvelle ville" value={name} onChange={(event) => setName(event.target.value)} />
          <Button type="submit" disabled={!name.trim() || saveCity.isPending}>
            <Plus aria-hidden="true" />
            Ajouter
          </Button>
        </form>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {cities.isPending && <LoadingState rows={2} />}
        {cities.isError && <ErrorState onRetry={() => cities.refetch()} />}
        <ul className="grid gap-1 sm:grid-cols-2">
          {cities.data?.map((city: City) => (
            <li key={city.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-muted/60">
              {editing?.id === city.id ? (
                <form
                  className="flex flex-1 items-center gap-1"
                  onSubmit={(event) => {
                    event.preventDefault()
                    rename()
                  }}
                >
                  <Input
                    aria-label={`Nouveau nom pour ${city.name}`}
                    value={editing.name}
                    onChange={(event) => setEditing({ id: city.id, name: event.target.value })}
                    autoFocus
                  />
                  <Button type="submit" size="icon-sm" aria-label="Enregistrer" disabled={saveCity.isPending}>
                    <Check aria-hidden="true" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Annuler" onClick={() => setEditing(null)}>
                    <X aria-hidden="true" />
                  </Button>
                </form>
              ) : (
                <>
                  <span className="inline-flex items-center gap-2 text-sm">
                    <MapPin className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    {city.name}
                  </span>
                  <Button variant="ghost" size="icon-sm" aria-label={`Renommer ${city.name}`} onClick={() => setEditing({ id: city.id, name: city.name })}>
                    <Pencil aria-hidden="true" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function RouteEditSheet({ route, onClose }: { route: RouteRecord | null; onClose: () => void }) {
  return (
    <Sheet open={route !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        {route && <RouteEditForm key={route.id} route={route} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  )
}

function RouteEditForm({ route, onClose }: { route: RouteRecord; onClose: () => void }) {
  const saveRoute = useSaveAdminRoute()
  const [hours, setHours] = useState(route.estimated_duration_minutes ? String(route.estimated_duration_minutes / 60).replace('.', ',') : '')
  const [distance, setDistance] = useState(route.distance_km ? String(route.distance_km) : '')
  const [status, setStatus] = useState<RecordStatus>(route.status)

  const submit = () => {
    const minutes = hours ? Math.round(Number(hours.replace(',', '.')) * 60) : null
    saveRoute.mutate(
      { id: route.id, input: { estimated_duration_minutes: minutes, distance_km: distance ? Number(distance) : null, status } },
      {
        onSuccess: () => {
          toast.success('Itinéraire mis à jour.')
          onClose()
        },
      },
    )
  }

  const error = saveRoute.isError ? firstError(saveRoute.error) : null

  return (
    <>
      <SheetHeader>
        <SheetTitle>
          {route.departure_city.name} → {route.destination_city.name}
        </SheetTitle>
        <SheetDescription>Les villes d'un itinéraire ne changent pas ; désactivez-le pour le retirer de la recherche.</SheetDescription>
      </SheetHeader>
      <form
        className="grid gap-4 px-4 pb-6"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="route-edit-hours">Durée estimée (heures)</Label>
          <Input id="route-edit-hours" inputMode="decimal" value={hours} onChange={(event) => setHours(event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="route-edit-distance">Distance (km)</Label>
          <Input id="route-edit-distance" type="number" min={1} value={distance} onChange={(event) => setDistance(event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="route-edit-status">Statut</Label>
          <Select value={status} onValueChange={(value) => setStatus(value as RecordStatus)}>
            <SelectTrigger id="route-edit-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Actif</SelectItem>
              <SelectItem value="inactive">Désactivé</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={saveRoute.isPending}>
            {saveRoute.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Enregistrer
          </Button>
        </div>
      </form>
    </>
  )
}

/**
 * Itinéraires : référentiel partagé par toutes les organisations.
 */
function RoutesCard() {
  const routes = useAdminRoutes()
  const cities = useCities()
  const saveRoute = useSaveAdminRoute()
  const [from, setFrom] = useState<number>()
  const [to, setTo] = useState<number>()
  const [editing, setEditing] = useState<RouteRecord | null>(null)

  const create = () =>
    from &&
    to &&
    saveRoute.mutate(
      { input: { departure_city_id: from, destination_city_id: to } },
      {
        onSuccess: (route) => {
          toast.success(`Itinéraire ${route.departure_city.name} → ${route.destination_city.name} créé.`)
          setFrom(undefined)
          setTo(undefined)
        },
      },
    )

  const error = saveRoute.isError && !editing ? firstError(saveRoute.error) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Itinéraires</CardTitle>
        <CardDescription>Un aller et un retour sont deux itinéraires. Les agences peuvent en créer ; seule la plateforme les modifie.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid w-44 gap-1.5">
            <Label htmlFor="route-new-from">Départ</Label>
            <CitySelect id="route-new-from" cities={cities.data ?? []} value={from} onChange={setFrom} />
          </div>
          <div className="grid w-44 gap-1.5">
            <Label htmlFor="route-new-to">Arrivée</Label>
            <CitySelect id="route-new-to" cities={cities.data ?? []} value={to} onChange={setTo} />
          </div>
          <Button onClick={create} disabled={!from || !to || from === to || saveRoute.isPending}>
            <Plus aria-hidden="true" />
            Créer
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {routes.isPending && <LoadingState rows={2} />}
        {routes.isError && <ErrorState message={getErrorMessage(routes.error)} onRetry={() => routes.refetch()} />}
        {routes.data && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Itinéraire</TableHead>
                  <TableHead>Durée</TableHead>
                  <TableHead>Distance</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.data.data.map((route) => (
                  <TableRow key={route.id}>
                    <TableCell className="font-medium">
                      {route.departure_city.name} → {route.destination_city.name}
                    </TableCell>
                    <TableCell>{formatDuration(route.estimated_duration_minutes) ?? '—'}</TableCell>
                    <TableCell>{route.distance_km ? `${route.distance_km} km` : '—'}</TableCell>
                    <TableCell>
                      <RecordStatusBadge status={route.status} />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditing(route)}
                        aria-label={`Modifier ${route.departure_city.name} → ${route.destination_city.name}`}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <RouteEditSheet route={editing} onClose={() => setEditing(null)} />
    </Card>
  )
}

/**
 * Référentiels de la plateforme (/admin/referentials) : villes et itinéraires.
 */
export function AdminReferentialsPage() {
  return (
    <div className="grid gap-6">
      <PageHeader title="Villes et itinéraires" description="Référentiels partagés par toutes les organisations." />
      <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
        <CitiesCard />
        <RoutesCard />
      </div>
    </div>
  )
}
