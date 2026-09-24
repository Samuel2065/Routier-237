import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { City } from '@/types/api'

interface CitySelectProps {
  id: string
  cities: City[]
  value: number | undefined
  onChange: (value: number) => void
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
}

export function CitySelect({ id, cities, value, onChange, placeholder = 'Choisir une ville', disabled, invalid, describedBy }: CitySelectProps) {
  return (
    <Select value={value ? String(value) : ''} onValueChange={(next) => onChange(Number(next))} disabled={disabled}>
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid || undefined} aria-describedby={describedBy}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {cities.map((city) => (
          <SelectItem key={city.id} value={String(city.id)}>
            {city.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
