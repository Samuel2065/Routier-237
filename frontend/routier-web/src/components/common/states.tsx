import type { ReactNode } from 'react'
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * États de chargement, vide et erreur conçus explicitement (§18.1).
 */

export function LoadingState({ rows = 3, label = 'Chargement…', className }: { rows?: number; label?: string; className?: string }) {
  return (
    <div className={cn('grid gap-3', className)} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  )
}

export function ErrorState({
  title = 'Impossible de charger ces informations',
  message,
  onRetry,
  className,
}: {
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-6 py-10 text-center', className)}
    >
      <AlertTriangle className="size-8 text-destructive" aria-hidden="true" />
      <div className="grid gap-1">
        <p className="font-medium">{title}</p>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw aria-hidden="true" />
          Réessayer
        </Button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center', className)}>
      {icon ?? <Inbox className="size-8 text-muted-foreground" aria-hidden="true" />}
      <div className="grid gap-1">
        <p className="font-medium">{title}</p>
        {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
