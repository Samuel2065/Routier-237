import { Avatar } from 'radix-ui'
import { cn } from '@/lib/utils'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2)

  return letters.toUpperCase()
}

/**
 * Photo du compte, ou initiales tant qu'aucune photo n'est enregistrée (ou si elle ne charge pas).
 */
export function UserAvatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  return (
    <Avatar.Root className={cn('relative inline-flex size-9 shrink-0 overflow-hidden rounded-full select-none', className)}>
      {src && <Avatar.Image src={src} alt="" className="size-full object-cover" />}
      <Avatar.Fallback
        delayMs={src ? 300 : 0}
        className="flex size-full items-center justify-center bg-secondary text-xs font-semibold text-secondary-foreground"
        aria-hidden="true"
      >
        {initials(name)}
      </Avatar.Fallback>
    </Avatar.Root>
  )
}
