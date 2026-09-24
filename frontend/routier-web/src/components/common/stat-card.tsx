import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'

export function StatCard({ label, value, hint, icon: Icon }: { label: string; value: ReactNode; hint?: ReactNode; icon: LucideIcon }) {
  return (
    <Card size="sm">
      <CardContent className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </CardContent>
    </Card>
  )
}
