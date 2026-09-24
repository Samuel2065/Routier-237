import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { CitySelect } from '@/components/common/city-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateRoute } from '@/features/agency/queries'
import { useCities } from '@/features/trips/queries'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'

/**
 * Création rapide d'un itinéraire manquant (référentiel partagé : seule la plateforme
 * peut ensuite le modifier). Un aller et un retour sont deux itinéraires.
 */
export function RouteQuickCreate({ onCreated, onCancel }: { onCreated: (routeId: number) => void; onCancel: () => void }) {
  const cities = useCities()
  const createRoute = useCreateRoute()
  const [from, setFrom] = useState<number>()
  const [to, setTo] = useState<number>()
  const [hours, setHours] = useState('')
  const [distance, setDistance] = useState('')

  const fieldErrors = getFieldErrors(createRoute.error)
  const error =
    Object.values(fieldErrors)[0] ?? (createRoute.isError ? getErrorMessage(createRoute.error) : from && to && from === to ? 'Choisissez deux villes différentes.' : null)

  const submit = () => {
    if (!from || !to || from === to) return
    const duration = hours ? Math.round(Number(hours.replace(',', '.')) * 60) : null
    createRoute.mutate(
      {
        departure_city_id: from,
        destination_city_id: to,
        estimated_duration_minutes: duration && duration > 0 ? duration : null,
        distance_km: distance ? Number(distance) : null,
      },
      {
        onSuccess: (route) => {
          toast.success(`Itinéraire ${route.departure_city.name} → ${route.destination_city.name} créé.`)
          onCreated(route.id)
        },
      },
    )
  }

  return (
    <div className="grid gap-3 rounded-lg border bg-muted/40 p-3" role="group" aria-label="Nouvel itinéraire">
      <p className="text-sm font-medium">Nouvel itinéraire</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="route-from">Départ</Label>
          <CitySelect id="route-from" cities={cities.data ?? []} value={from} onChange={setFrom} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="route-to">Arrivée</Label>
          <CitySelect id="route-to" cities={cities.data ?? []} value={to} onChange={setTo} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="route-hours">Durée estimée (heures)</Label>
          <Input id="route-hours" inputMode="decimal" placeholder="5,5" value={hours} onChange={(event) => setHours(event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="route-distance">Distance (km)</Label>
          <Input id="route-distance" type="number" min={1} value={distance} onChange={(event) => setDistance(event.target.value)} />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Fermer
        </Button>
        <Button type="button" size="sm" onClick={submit} disabled={!from || !to || from === to || createRoute.isPending}>
          {createRoute.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Créer l'itinéraire
        </Button>
      </div>
    </div>
  )
}
