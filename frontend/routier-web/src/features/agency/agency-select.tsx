import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useManagedAgencies } from '@/features/agency/queries'
import { useCan, useIsMultiAgency } from '@/features/agency/session'

const ALL = 'all'

/**
 * Choix d'agence pour un director (plusieurs agences). Invisible pour le personnel
 * d'une seule agence, dont le périmètre est imposé par l'API.
 */
export function AgencySelect({
  id = 'agency-filter',
  value,
  onChange,
  allowAll = true,
  placeholder = 'Choisir une agence',
  className = 'w-56',
  invalid,
}: {
  id?: string
  value: number | undefined
  onChange: (value: number | undefined) => void
  allowAll?: boolean
  placeholder?: string
  className?: string
  invalid?: boolean
}) {
  const multiAgency = useIsMultiAgency()
  const can = useCan()
  const agencies = useManagedAgencies(multiAgency && can('agencies.view'))

  if (!multiAgency) return null

  return (
    <Select value={value ? String(value) : allowAll ? ALL : ''} onValueChange={(next) => onChange(next === ALL ? undefined : Number(next))}>
      <SelectTrigger id={id} className={className} aria-invalid={invalid || undefined}>
        <SelectValue placeholder={agencies.isPending ? 'Chargement…' : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowAll && <SelectItem value={ALL}>Toutes les agences</SelectItem>}
        {agencies.data?.data.map((agency) => (
          <SelectItem key={agency.id} value={String(agency.id)}>
            {agency.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
