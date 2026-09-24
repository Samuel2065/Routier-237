import { zodResolver } from '@hookform/resolvers/zod'
import { Bus, Loader2, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormField } from '@/components/common/form-field'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AgencySelect } from '@/features/agency/agency-select'
import { useRoutes, useSaveTrip, useVehicles } from '@/features/agency/queries'
import { useCan, useIsMultiAgency } from '@/features/agency/session'
import { RouteQuickCreate } from '@/features/agency/trips/route-quick-create'
import { applyServerErrors, getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { fieldAria } from '@/lib/field-aria'
import { formatDuration, todayInCameroon } from '@/lib/format'
import type { ManagedTrip } from '@/types/api'

const tripSchema = z.object({
  agency_id: z.number().int().positive().optional(),
  route_id: z.number({ error: "Choisissez l'itinéraire." }).int().positive({ error: "Choisissez l'itinéraire." }),
  vehicle_id: z.number({ error: 'Choisissez le véhicule.' }).int().positive({ error: 'Choisissez le véhicule.' }),
  departure_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Choisissez la date de départ.' }),
  departure_time: z.string().regex(/^\d{2}:\d{2}$/, { error: "Indiquez l'heure de départ." }),
  price: z
    .number({ error: 'Indiquez le prix.' })
    .int({ error: 'Prix en FCFA, sans décimales.' })
    .min(1, { error: 'Le prix doit être positif.' })
    .max(1_000_000, { error: 'Prix trop élevé.' }),
  publish: z.boolean(),
})

type TripFormValues = z.infer<typeof tripSchema>

/**
 * Création / modification d'un trajet. La classe n'est pas saisie : c'est celle du
 * véhicule (VIP et Classique sont des véhicules distincts). Les contrôles de cohérence
 * (chevauchement, places déjà réservées) sont faits par l'API.
 */
export function TripFormSheet({ open, onOpenChange, trip }: { open: boolean; onOpenChange: (open: boolean) => void; trip?: ManagedTrip }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {open && <TripForm key={trip?.id ?? 'new'} trip={trip} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

function TripForm({ trip, onDone }: { trip?: ManagedTrip; onDone: () => void }) {
  const can = useCan()
  const multiAgency = useIsMultiAgency()
  const saveTrip = useSaveTrip()
  const routes = useRoutes()
  const [creatingRoute, setCreatingRoute] = useState(false)
  const editing = !!trip

  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<TripFormValues>({
    resolver: zodResolver(tripSchema),
    defaultValues: trip
        ? {
            agency_id: trip.agency.id,
            route_id: trip.route.id,
            vehicle_id: trip.vehicle.id,
            departure_date: trip.departure_date,
            departure_time: trip.departure_time,
            price: trip.price,
            publish: false,
          }
        : { departure_date: todayInCameroon(), departure_time: '06:00', publish: false },
  })

  const agencyId = useWatch({ control, name: 'agency_id' })
  const vehicleId = useWatch({ control, name: 'vehicle_id' })
  const vehicleAgency = editing ? trip.agency.id : agencyId
  const vehicles = useVehicles({ agency_id: vehicleAgency, status: 'active', per_page: 100 }, !multiAgency || !!vehicleAgency)
  const selectedVehicle = vehicles.data?.data.find((vehicle) => vehicle.id === vehicleId)
  const needsAgencyFirst = multiAgency && !vehicleAgency
  const noVehicle = !needsAgencyFirst && vehicles.isSuccess && vehicles.data.data.length === 0

  const onSubmit = handleSubmit((values) => {
    if (!editing && multiAgency && !values.agency_id) {
      setError('agency_id', { message: "Choisissez l'agence." })
      return
    }

    const input = {
      route_id: values.route_id,
      vehicle_id: values.vehicle_id,
      departure_date: values.departure_date,
      departure_time: values.departure_time,
      price: values.price,
      ...(editing ? {} : { agency_id: multiAgency ? values.agency_id : undefined, status: values.publish ? ('published' as const) : ('draft' as const) }),
    }

    saveTrip.mutate(
      { id: trip?.id, input },
      {
        onSuccess: () => {
          toast.success(editing ? 'Trajet mis à jour.' : values.publish ? 'Trajet créé et publié.' : 'Trajet créé en brouillon.')
          onDone()
        },
        onError: (error) => {
          applyServerErrors(error, setError)
        },
      },
    )
  })

  const generalError = saveTrip.isError && Object.keys(getFieldErrors(saveTrip.error)).length === 0 ? getErrorMessage(saveTrip.error) : null

  return (
    <>
        <SheetHeader>
          <SheetTitle>{editing ? 'Modifier le trajet' : 'Nouveau trajet'}</SheetTitle>
          <SheetDescription>
            {editing && trip.reserved_seats > 0
              ? `${trip.reserved_seats} place(s) déjà réservée(s) : itinéraire et classe ne peuvent plus changer.`
              : 'La classe et la capacité sont celles du véhicule choisi.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} noValidate className="grid gap-4 px-4 pb-6">
          {!editing && multiAgency && (
            <FormField id="trip-agency" label="Agence" required error={errors.agency_id?.message}>
              <Controller
                control={control}
                name="agency_id"
                render={({ field }) => (
                  <AgencySelect
                    id="trip-agency"
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value)
                      setValue('vehicle_id', undefined as unknown as number)
                    }}
                    allowAll={false}
                    className="w-full"
                    invalid={!!errors.agency_id}
                  />
                )}
              />
            </FormField>
          )}

          <FormField id="trip-route" label="Itinéraire" required error={errors.route_id?.message}>
            <Controller
              control={control}
              name="route_id"
              render={({ field }) => (
                <Select value={field.value ? String(field.value) : ''} onValueChange={(value) => field.onChange(Number(value))}>
                  <SelectTrigger id="trip-route" className="w-full" aria-invalid={!!errors.route_id || undefined}>
                    <SelectValue placeholder={routes.isPending ? 'Chargement…' : 'Choisir un itinéraire'} />
                  </SelectTrigger>
                  <SelectContent>
                    {routes.data?.data.map((route) => (
                      <SelectItem key={route.id} value={String(route.id)}>
                        {route.departure_city.name} → {route.destination_city.name}
                        {route.estimated_duration_minutes ? ` (${formatDuration(route.estimated_duration_minutes)})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          {can('routes.manage') && !creatingRoute && (
            <Button type="button" variant="link" size="sm" className="-mt-2 w-fit px-0" onClick={() => setCreatingRoute(true)}>
              <Plus aria-hidden="true" />
              Itinéraire absent de la liste ?
            </Button>
          )}
          {creatingRoute && (
            <RouteQuickCreate
              onCancel={() => setCreatingRoute(false)}
              onCreated={(routeId) => {
                setValue('route_id', routeId, { shouldValidate: true })
                setCreatingRoute(false)
              }}
            />
          )}

          <FormField id="trip-vehicle" label="Véhicule" required error={errors.vehicle_id?.message}>
            <Controller
              control={control}
              name="vehicle_id"
              render={({ field }) => (
                <Select
                  value={field.value ? String(field.value) : ''}
                  onValueChange={(value) => field.onChange(Number(value))}
                  disabled={needsAgencyFirst || noVehicle || vehicles.isPending}
                >
                  <SelectTrigger
                    id="trip-vehicle"
                    className="w-full"
                    aria-invalid={!!errors.vehicle_id || undefined}
                    aria-describedby={noVehicle ? 'trip-vehicle-empty' : undefined}
                  >
                    <SelectValue
                      placeholder={
                        needsAgencyFirst
                          ? "Choisissez d'abord l'agence"
                          : vehicles.isPending
                            ? 'Chargement des véhicules…'
                            : noVehicle
                              ? 'Aucun véhicule en service'
                              : 'Choisir un véhicule'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.data?.data.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={String(vehicle.id)}>
                        {vehicle.registration_number} · {vehicle.travel_class?.name} · {vehicle.capacity} places
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          {vehicles.isError && (
            <p role="alert" className="-mt-2 text-xs text-destructive">
              Impossible de charger les véhicules.{' '}
              <button type="button" className="underline" onClick={() => vehicles.refetch()}>
                Réessayer
              </button>
            </p>
          )}
          {noVehicle && (
            <Alert id="trip-vehicle-empty" className="-mt-2">
              <Bus aria-hidden="true" />
              <AlertTitle>Aucun véhicule en service dans cette agence</AlertTitle>
              <AlertDescription className="grid gap-2">
                <span>Un trajet prend la classe (VIP ou Classique) et la capacité d'un véhicule : ajoutez d'abord un véhicule à cette agence.</span>
                {can('vehicles.create') ? (
                  <Button asChild size="sm" variant="outline" className="w-fit">
                    <Link to={`/agency/vehicles?new=1${vehicleAgency ? `&agency_id=${vehicleAgency}` : ''}`} onClick={onDone}>
                      <Plus aria-hidden="true" />
                      Ajouter un véhicule
                    </Link>
                  </Button>
                ) : (
                  <span>Demandez au responsable de l'agence d'enregistrer un véhicule.</span>
                )}
              </AlertDescription>
            </Alert>
          )}
          {selectedVehicle && (
            <p className="-mt-2 text-xs text-muted-foreground">
              Classe du trajet : <strong>{selectedVehicle.travel_class?.name}</strong> — {selectedVehicle.brand} {selectedVehicle.model},{' '}
              {selectedVehicle.capacity} places.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="trip-date" label="Date de départ" required error={errors.departure_date?.message}>
              <Input type="date" min={todayInCameroon()} {...fieldAria('trip-date', errors.departure_date?.message)} {...register('departure_date')} />
            </FormField>
            <FormField id="trip-time" label="Heure de départ" required error={errors.departure_time?.message}>
              <Input type="time" {...fieldAria('trip-time', errors.departure_time?.message)} {...register('departure_time')} />
            </FormField>
          </div>

          <FormField id="trip-price" label="Prix par passager (FCFA)" required error={errors.price?.message}>
            <Input
              type="number"
              min={1}
              step={50}
              inputMode="numeric"
              {...fieldAria('trip-price', errors.price?.message)}
              {...register('price', { valueAsNumber: true })}
            />
          </FormField>

          {!editing && can('trips.publish') && (
            <Controller
              control={control}
              name="publish"
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <Checkbox id="trip-publish" checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                  <Label htmlFor="trip-publish" className="font-normal">
                    Publier immédiatement (visible dans la recherche publique)
                  </Label>
                </div>
              )}
            />
          )}

          {generalError && (
            <Alert variant="destructive">
              <AlertDescription>{generalError}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onDone}>
              Annuler
            </Button>
            <Button type="submit" disabled={saveTrip.isPending}>
              {saveTrip.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {editing ? 'Enregistrer' : 'Créer le trajet'}
            </Button>
          </div>
        </form>
    </>
  )
}
