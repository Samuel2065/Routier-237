import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus, Trash2, UserRound } from 'lucide-react'
import { useMemo } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { FormField } from '@/components/common/form-field'
import { fieldAria } from '@/lib/field-aria'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  emptyPassenger,
  makeBookingSchema,
  MAX_PASSENGERS_PER_BOOKING,
  toPassengerPayload,
  type BookingFormValues,
} from '@/features/reservations/booking-schema'
import { useCreateReservation } from '@/features/reservations/queries'
import { applyServerErrors, getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { formatPrice } from '@/lib/format'
import { PASSENGER_TYPE_LABELS } from '@/lib/labels'
import type { PublicTrip, Reservation, User } from '@/types/api'

interface BookingFormProps {
  trip: PublicTrip
  customer: User
  initialPassengers?: number
  onBooked: (reservation: Reservation) => void
}

/**
 * Saisie des passagers d'une réservation (§5.2, étapes 4 à 7). Un enfant peut être
 * enregistré sans compte. Le prix total est indicatif : l'API fige le montant.
 */
export function BookingForm({ trip, customer, initialPassengers = 1, onBooked }: BookingFormProps) {
  const maxPassengers = Math.min(MAX_PASSENGERS_PER_BOOKING, trip.remaining_seats)
  const schema = useMemo(() => makeBookingSchema(maxPassengers), [maxPassengers])
  const createReservation = useCreateReservation()

  const firstCount = Math.max(1, Math.min(initialPassengers, maxPassengers))
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      passengers: [
        { ...emptyPassenger(), full_name: customer.name, phone: customer.phone ?? '' },
        ...Array.from({ length: firstCount - 1 }, () => emptyPassenger()),
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'passengers' })
  const passengers = useWatch({ control, name: 'passengers' })
  const count = passengers?.length ?? 0
  const total = count * trip.price

  const onSubmit = handleSubmit((values) => {
    createReservation.mutate(
      { trip_id: trip.id, passengers: values.passengers.map(toPassengerPayload) },
      {
        onSuccess: onBooked,
        onError: (error) => {
          applyServerErrors(error, setError)
        },
      },
    )
  })

  const serverError =
    createReservation.isError && Object.keys(getFieldErrors(createReservation.error)).length === 0
      ? getErrorMessage(createReservation.error)
      : null

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4" aria-label="Passagers de la réservation">
      {fields.map((field, index) => {
        const fieldErrors = errors.passengers?.[index]
        const prefix = `passengers-${index}`

        return (
          <Card key={field.id} size="sm">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <UserRound className="size-4 text-muted-foreground" aria-hidden="true" />
                Passager {index + 1}
              </CardTitle>
              {fields.length > 1 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} aria-label={`Retirer le passager ${index + 1}`}>
                  <Trash2 aria-hidden="true" />
                  Retirer
                </Button>
              )}
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField id={`${prefix}-full_name`} label="Nom complet" required error={fieldErrors?.full_name?.message} className="sm:col-span-2">
                <Input
                  autoComplete={index === 0 ? 'name' : 'off'}
                  {...fieldAria(`${prefix}-full_name`, fieldErrors?.full_name?.message)}
                  {...register(`passengers.${index}.full_name`)}
                />
              </FormField>

              <FormField id={`${prefix}-passenger_type`} label="Type" required error={fieldErrors?.passenger_type?.message}>
                <Controller
                  control={control}
                  name={`passengers.${index}.passenger_type`}
                  render={({ field: typeField }) => (
                    <Select value={typeField.value} onValueChange={typeField.onChange}>
                      <SelectTrigger id={`${prefix}-passenger_type`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="adult">{PASSENGER_TYPE_LABELS.adult}</SelectItem>
                        <SelectItem value="child">{PASSENGER_TYPE_LABELS.child}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>

              <FormField id={`${prefix}-phone`} label="Téléphone" hint="Facultatif" error={fieldErrors?.phone?.message}>
                <Input
                  type="tel"
                  placeholder="699 12 34 56"
                  {...fieldAria(`${prefix}-phone`, fieldErrors?.phone?.message, 'Facultatif')}
                  {...register(`passengers.${index}.phone`)}
                />
              </FormField>

              <FormField id={`${prefix}-birth_date`} label="Date de naissance" hint="Facultatif" error={fieldErrors?.birth_date?.message}>
                <Input
                  type="date"
                  {...fieldAria(`${prefix}-birth_date`, fieldErrors?.birth_date?.message, 'Facultatif')}
                  {...register(`passengers.${index}.birth_date`)}
                />
              </FormField>
            </CardContent>
          </Card>
        )
      })}

      {errors.passengers?.root?.message && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {errors.passengers.root.message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => append(emptyPassenger())} disabled={count >= maxPassengers}>
          <Plus aria-hidden="true" />
          Ajouter un adulte
        </Button>
        <Button type="button" variant="outline" onClick={() => append(emptyPassenger('child'))} disabled={count >= maxPassengers}>
          <Plus aria-hidden="true" />
          Ajouter un enfant
        </Button>
      </div>
      {count >= maxPassengers && (
        <p className="text-xs text-muted-foreground">
          {maxPassengers} passager(s) au maximum pour cette réservation (places restantes : {trip.remaining_seats}).
        </p>
      )}

      <Separator />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-live="polite">
        <div>
          <p className="text-sm text-muted-foreground">
            {count} × {formatPrice(trip.price)}
          </p>
          <p className="text-xl font-semibold">Total : {formatPrice(total)}</p>
        </div>
        <Button type="submit" size="lg" className="h-10 px-6" disabled={createReservation.isPending}>
          {createReservation.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Réserver et passer au paiement
        </Button>
      </div>

      {serverError && (
        <Alert variant="destructive">
          <AlertTitle>Réservation impossible</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
    </form>
  )
}
