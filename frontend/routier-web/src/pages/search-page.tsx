import { CalendarSearch, ChevronLeft, ChevronRight } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { Container } from '@/components/layout/container'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTravelClasses, useTripSearch } from '@/features/trips/queries'
import { SearchForm } from '@/features/trips/search-form'
import { parseSearchParams, toSearchQuery } from '@/features/trips/search-schema'
import { TripCard } from '@/features/trips/trip-card'
import { getErrorMessage } from '@/lib/api-error'
import { addDays, formatDate, pluralize, todayInCameroon } from '@/lib/format'

const ALL_CLASSES = 'all'

/**
 * Résultats de recherche (/search). Les critères sont portés par l'URL.
 */
export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const criteria = parseSearchParams(searchParams)
  const search = useTripSearch(criteria)
  const travelClasses = useTravelClasses()

  const updateParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next)
  }

  const shiftDate = (days: number) => {
    if (!criteria) return
    setSearchParams(toSearchQuery({ ...criteria, date: addDays(criteria.date, days) }))
  }

  return (
    <Container className="grid gap-6">
      <Card>
        <CardContent>
          <SearchForm key={searchParams.toString()} inline defaultValues={criteria ?? undefined} />
        </CardContent>
      </Card>

      {!criteria ? (
        <EmptyState
          icon={<CalendarSearch className="size-8 text-muted-foreground" aria-hidden="true" />}
          title="Indiquez votre trajet"
          description="Choisissez une ville de départ, une ville d'arrivée et une date pour voir les trajets disponibles."
        />
      ) : (
        <section aria-labelledby="results-title" className="grid gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid gap-1">
              <h1 id="results-title" className="text-xl font-semibold">
                {search.data ? `${search.data.meta.departure_city.name} → ${search.data.meta.destination_city.name}` : 'Trajets disponibles'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {formatDate(criteria.date)} · {pluralize(criteria.passengers ?? 1, 'passager')}
                {search.data && ` · ${pluralize(search.data.meta.count, 'trajet disponible', 'trajets disponibles')}`}
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="sort">Trier par</Label>
                <Select value={criteria.sort ?? 'departure'} onValueChange={(value) => updateParam('sort', value === 'price' ? 'price' : undefined)}>
                  <SelectTrigger id="sort" className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="departure">Heure de départ</SelectItem>
                    <SelectItem value="price">Prix</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="travel_class">Classe</Label>
                <Select
                  value={criteria.travel_class_id ? String(criteria.travel_class_id) : ALL_CLASSES}
                  onValueChange={(value) => updateParam('travel_class_id', value === ALL_CLASSES ? undefined : value)}
                >
                  <SelectTrigger id="travel_class" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_CLASSES}>Toutes</SelectItem>
                    {travelClasses.data?.map((travelClass) => (
                      <SelectItem key={travelClass.id} value={String(travelClass.id)}>
                        {travelClass.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => shiftDate(-1)} disabled={criteria.date <= todayInCameroon()}>
              <ChevronLeft aria-hidden="true" />
              Jour précédent
            </Button>
            <Button variant="outline" size="sm" onClick={() => shiftDate(1)}>
              Jour suivant
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>

          {search.isPending && <LoadingState rows={3} label="Recherche des trajets…" />}
          {search.isError && <ErrorState message={getErrorMessage(search.error)} onRetry={() => search.refetch()} />}
          {search.data && search.data.data.length === 0 && (
            <EmptyState
              title="Aucun trajet disponible pour cette date"
              description="Essayez une autre date ou une autre classe. Seuls les trajets publiés avec des places libres sont affichés."
            />
          )}
          {search.data && search.data.data.length > 0 && (
            <ul className={`grid gap-3 ${search.isFetching ? 'opacity-60' : ''}`} aria-busy={search.isFetching}>
              {search.data.data.map((trip) => (
                <li key={trip.id}>
                  <TripCard trip={trip} passengers={criteria.passengers} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </Container>
  )
}
