import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type StatTone = 'primary' | 'success' | 'warning' | 'danger' | 'info'

const TONES: Record<StatTone, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-rose-50 text-rose-700',
  info: 'bg-sky-50 text-sky-700',
}

/**
 * Indicateur chiffré d'un tableau de bord. Pas de variation affichée : l'API ne calcule
 * pas d'évolution d'une période à l'autre.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'primary',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon: LucideIcon
  tone?: StatTone
}) {
  return (
    <Card className="transition-shadow duration-200 [--card-spacing:--spacing(5)] hover:shadow-card-hover">
      <CardContent className="grid gap-4">
        <span className={cn('flex size-11 items-center justify-center rounded-xl', TONES[tone])}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="grid gap-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight tabular-nums sm:text-[1.75rem]">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
