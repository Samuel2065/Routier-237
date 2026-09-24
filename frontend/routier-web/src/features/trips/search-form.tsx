import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeftRight, Search } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { CitySelect } from '@/components/common/city-select'
import { FormField } from '@/components/common/form-field'
import { fieldAria } from '@/lib/field-aria'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MAX_SEARCH_PASSENGERS, searchSchema, toSearchQuery, type SearchFormValues } from '@/features/trips/search-schema'
import { useCities } from '@/features/trips/queries'
import { todayInCameroon } from '@/lib/format'
import { cn } from '@/lib/utils'

interface SearchFormProps {
  defaultValues?: Partial<SearchFormValues>
  className?: string
  /** Mise en page en ligne (page de résultats). */
  inline?: boolean
}

/**
 * Moteur de recherche public : aucun compte requis (§4.1). Les critères sont
 * portés par l'URL de la page de résultats (partageable).
 */
export function SearchForm({ defaultValues, className, inline = false }: SearchFormProps) {
  const navigate = useNavigate()
  const cities = useCities()
  const today = todayInCameroon()

  const {
    control,
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: { date: today, passengers: 1, ...defaultValues },
  })

  const onSubmit = handleSubmit((values) => {
    navigate(`/search?${toSearchQuery(values)}`)
  })

  const swapCities = () => {
    const { departure_city_id: from, destination_city_id: to } = getValues()
    setValue('departure_city_id', to, { shouldValidate: false })
    setValue('destination_city_id', from, { shouldValidate: false })
  }

  const cityList = cities.data ?? []
  const citiesUnavailable = cities.isError

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label="Rechercher un trajet"
      className={cn('grid gap-4', inline ? 'lg:grid-cols-[1fr_auto_1fr_11rem_7rem_auto] lg:items-start' : 'md:grid-cols-2', className)}
    >
      <FormField id="departure_city_id" label="Départ" error={errors.departure_city_id?.message}>
        <Controller
          control={control}
          name="departure_city_id"
          render={({ field }) => (
            <CitySelect
              id="departure_city_id"
              cities={cityList}
              value={field.value}
              onChange={field.onChange}
              placeholder={cities.isPending ? 'Chargement…' : 'Ville de départ'}
              disabled={cities.isPending || citiesUnavailable}
              invalid={!!errors.departure_city_id}
              describedBy={errors.departure_city_id ? 'departure_city_id-error' : undefined}
            />
          )}
        />
      </FormField>

      <div className={cn('flex justify-center', inline ? 'lg:pt-6' : 'md:hidden')}>
        <Button type="button" variant="ghost" size="icon" onClick={swapCities} aria-label="Inverser départ et arrivée">
          <ArrowLeftRight aria-hidden="true" />
        </Button>
      </div>

      <FormField id="destination_city_id" label="Arrivée" error={errors.destination_city_id?.message}>
        <Controller
          control={control}
          name="destination_city_id"
          render={({ field }) => (
            <CitySelect
              id="destination_city_id"
              cities={cityList}
              value={field.value}
              onChange={field.onChange}
              placeholder={cities.isPending ? 'Chargement…' : "Ville d'arrivée"}
              disabled={cities.isPending || citiesUnavailable}
              invalid={!!errors.destination_city_id}
              describedBy={errors.destination_city_id ? 'destination_city_id-error' : undefined}
            />
          )}
        />
      </FormField>

      <FormField id="date" label="Date" error={errors.date?.message}>
        <Input type="date" min={today} {...fieldAria('date', errors.date?.message)} {...register('date')} />
      </FormField>

      <FormField id="passengers" label="Passagers" error={errors.passengers?.message}>
        <Input
          type="number"
          min={1}
          max={MAX_SEARCH_PASSENGERS}
          inputMode="numeric"
          {...fieldAria('passengers', errors.passengers?.message)}
          {...register('passengers', { valueAsNumber: true })}
        />
      </FormField>

      <div className={cn(inline ? 'lg:pt-6' : 'md:col-span-2')}>
        <Button type="submit" size="lg" className="h-9 w-full px-5" disabled={citiesUnavailable}>
          <Search aria-hidden="true" />
          Rechercher
        </Button>
      </div>

      {citiesUnavailable && (
        <p role="alert" className="text-sm text-destructive md:col-span-2 lg:col-span-full">
          La liste des villes est indisponible pour le moment.{' '}
          <button type="button" className="underline" onClick={() => cities.refetch()}>
            Réessayer
          </button>
        </p>
      )}
    </form>
  )
}
