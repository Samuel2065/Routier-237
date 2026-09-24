import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormField } from '@/components/common/form-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AgencySelect } from '@/features/agency/agency-select'
import { useSaveVehicle } from '@/features/agency/queries'
import { useIsMultiAgency } from '@/features/agency/session'
import { useTravelClasses } from '@/features/trips/queries'
import { applyServerErrors, getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { fieldAria } from '@/lib/field-aria'
import { VEHICLE_STATUS_LABELS } from '@/lib/labels'
import type { Vehicle, VehicleStatus } from '@/types/api'

const vehicleSchema = z.object({
  agency_id: z.number().int().positive().optional(),
  travel_class_id: z.number({ error: 'Choisissez la classe.' }).int().positive({ error: 'Choisissez la classe.' }),
  registration_number: z.string().trim().min(2, { error: "Indiquez l'immatriculation." }).max(30),
  brand: z.string().trim().min(1, { error: 'Indiquez la marque.' }).max(60),
  model: z.string().trim().min(1, { error: 'Indiquez le modèle.' }).max(60),
  capacity: z
    .number({ error: 'Indiquez la capacité.' })
    .int()
    .min(1, { error: 'Au moins 1 place.' })
    .max(100, { error: '100 places au maximum.' }),
  amenities: z.string().max(500),
  status: z.enum(['active', 'maintenance', 'retired']),
})

type VehicleFormValues = z.infer<typeof vehicleSchema>

const STATUSES: VehicleStatus[] = ['active', 'maintenance', 'retired']

export function VehicleFormSheet({
  open,
  onOpenChange,
  vehicle,
  defaultAgencyId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicle?: Vehicle
  /** Agence présélectionnée (director, création depuis le formulaire de trajet). */
  defaultAgencyId?: number
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {open && <VehicleForm key={vehicle?.id ?? 'new'} vehicle={vehicle} defaultAgencyId={defaultAgencyId} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

/**
 * Fiche véhicule : sa classe et sa capacité réelle déterminent celles de ses trajets.
 */
function VehicleForm({ vehicle, defaultAgencyId, onDone }: { vehicle?: Vehicle; defaultAgencyId?: number; onDone: () => void }) {
  const multiAgency = useIsMultiAgency()
  const travelClasses = useTravelClasses()
  const saveVehicle = useSaveVehicle()
  const editing = !!vehicle

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: vehicle
      ? {
          travel_class_id: vehicle.travel_class?.id,
          registration_number: vehicle.registration_number,
          brand: vehicle.brand,
          model: vehicle.model,
          capacity: vehicle.capacity,
          amenities: vehicle.amenities.join(', '),
          status: vehicle.status,
        }
      : { agency_id: defaultAgencyId, amenities: '', status: 'active' },
  })

  const onSubmit = handleSubmit((values) => {
    if (!editing && multiAgency && !values.agency_id) {
      setError('agency_id', { message: "Choisissez l'agence." })
      return
    }

    const input = {
      travel_class_id: values.travel_class_id,
      registration_number: values.registration_number,
      brand: values.brand,
      model: values.model,
      capacity: values.capacity,
      amenities: values.amenities
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      status: values.status,
      ...(!editing && multiAgency ? { agency_id: values.agency_id } : {}),
    }

    saveVehicle.mutate(
      { id: vehicle?.id, input },
      {
        onSuccess: () => {
          toast.success(editing ? 'Véhicule mis à jour.' : 'Véhicule enregistré.')
          onDone()
        },
        onError: (error) => {
          applyServerErrors(error, setError)
        },
      },
    )
  })

  const generalError = saveVehicle.isError && Object.keys(getFieldErrors(saveVehicle.error)).length === 0 ? getErrorMessage(saveVehicle.error) : null

  return (
    <>
      <SheetHeader>
        <SheetTitle>{editing ? `Véhicule ${vehicle.registration_number}` : 'Nouveau véhicule'}</SheetTitle>
        <SheetDescription>
          {editing && vehicle.upcoming_trips_count
            ? `${vehicle.upcoming_trips_count} trajet(s) à venir : classe figée, capacité jamais sous les places réservées.`
            : 'VIP et Classique sont des véhicules distincts, chacun avec sa propre capacité.'}
        </SheetDescription>
      </SheetHeader>

      <form onSubmit={onSubmit} noValidate className="grid gap-4 px-4 pb-6">
        {!editing && multiAgency && (
          <FormField id="vehicle-agency" label="Agence" required error={errors.agency_id?.message}>
            <Controller
              control={control}
              name="agency_id"
              render={({ field }) => (
                <AgencySelect id="vehicle-agency" value={field.value} onChange={field.onChange} allowAll={false} className="w-full" invalid={!!errors.agency_id} />
              )}
            />
          </FormField>
        )}

        <FormField id="vehicle-class" label="Classe" required error={errors.travel_class_id?.message}>
          <Controller
            control={control}
            name="travel_class_id"
            render={({ field }) => (
              <Select value={field.value ? String(field.value) : ''} onValueChange={(value) => field.onChange(Number(value))}>
                <SelectTrigger id="vehicle-class" className="w-full" aria-invalid={!!errors.travel_class_id || undefined}>
                  <SelectValue placeholder="Choisir une classe" />
                </SelectTrigger>
                <SelectContent>
                  {travelClasses.data?.map((travelClass) => (
                    <SelectItem key={travelClass.id} value={String(travelClass.id)}>
                      {travelClass.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        <FormField id="vehicle-plate" label="Immatriculation" required error={errors.registration_number?.message}>
          <Input placeholder="ES 214 AB" autoCapitalize="characters" {...fieldAria('vehicle-plate', errors.registration_number?.message)} {...register('registration_number')} />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="vehicle-brand" label="Marque" required error={errors.brand?.message}>
            <Input {...fieldAria('vehicle-brand', errors.brand?.message)} {...register('brand')} />
          </FormField>
          <FormField id="vehicle-model" label="Modèle" required error={errors.model?.message}>
            <Input {...fieldAria('vehicle-model', errors.model?.message)} {...register('model')} />
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="vehicle-capacity" label="Capacité (places)" required error={errors.capacity?.message}>
            <Input type="number" min={1} max={100} inputMode="numeric" {...fieldAria('vehicle-capacity', errors.capacity?.message)} {...register('capacity', { valueAsNumber: true })} />
          </FormField>
          <FormField id="vehicle-status" label="Statut" error={errors.status?.message}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="vehicle-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {VEHICLE_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
        </div>

        <FormField id="vehicle-amenities" label="Équipements" hint="Séparés par des virgules (climatisation, prises USB…)." error={errors.amenities?.message}>
          <Input
            placeholder="climatisation, sièges inclinables"
            {...fieldAria('vehicle-amenities', errors.amenities?.message, 'Séparés par des virgules (climatisation, prises USB…).')}
            {...register('amenities')}
          />
        </FormField>

        {generalError && (
          <Alert variant="destructive">
            <AlertDescription>{generalError}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" disabled={saveVehicle.isPending}>
            {saveVehicle.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {editing ? 'Enregistrer' : 'Ajouter le véhicule'}
          </Button>
        </div>
      </form>
    </>
  )
}
