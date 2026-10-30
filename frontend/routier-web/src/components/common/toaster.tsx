import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { dismissToast, getToasts, subscribeToasts, type ToastItem, type ToastTone } from '@/lib/toast'
import { cn } from '@/lib/utils'

const TONES: Record<ToastTone, { icon: typeof Info; accent: string; bar: string; button: string }> = {
  success: { icon: CircleCheck, accent: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-500', button: 'text-emerald-700 hover:bg-emerald-50' },
  error: { icon: CircleAlert, accent: 'bg-red-50 text-red-600', bar: 'bg-red-500', button: 'text-red-700 hover:bg-red-50' },
  warning: { icon: TriangleAlert, accent: 'bg-amber-50 text-amber-600', bar: 'bg-amber-500', button: 'text-amber-700 hover:bg-amber-50' },
  // Couleur de l'espace (client bleu, agence vert, admin ambre).
  info: { icon: Info, accent: 'bg-primary/10 text-primary', bar: 'bg-primary', button: 'text-primary hover:bg-primary/10' },
}

/** Vrai quand l'onglet est masqué : le compte à rebours attend le retour de l'utilisateur. */
function usePageHidden() {
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden)

  useEffect(() => {
    const sync = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])

  return hidden
}

function Toast({ item, pageHidden }: { item: ToastItem; pageHidden: boolean }) {
  const [hovered, setHovered] = useState(false)
  // Temps restant, conservé quand le survol ou l'onglet masqué suspend le compte à rebours.
  const remaining = useRef(item.duration)
  const paused = hovered || pageHidden || item.leaving
  const tone = TONES[item.tone]
  const Icon = tone.icon

  useEffect(() => {
    if (paused) return
    const startedAt = Date.now()
    const timer = window.setTimeout(() => dismissToast(item.id), remaining.current)
    return () => {
      window.clearTimeout(timer)
      remaining.current -= Date.now() - startedAt
    }
  }, [paused, item.id])

  return (
    <div
      role={item.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-xl border bg-popover py-3 pr-2 pl-3 text-popover-foreground',
        'shadow-[0_12px_32px_-12px_oklch(0.25_0.02_250/0.28),0_2px_6px_-2px_oklch(0.25_0.02_250/0.1)]',
        item.leaving ? 'motion-safe:animate-[toast-out_220ms_ease-in_forwards]' : 'motion-safe:animate-[toast-in_200ms_ease-out]',
      )}
    >
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-[17px]', tone.accent)}>
        {item.icon ?? <Icon aria-hidden="true" />}
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="text-sm font-semibold">{item.title}</p>
        {item.description && <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{item.description}</p>}
      </div>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            item.action?.onClick()
            dismissToast(item.id)
          }}
          className={cn('shrink-0 self-center rounded-md px-2 py-1 text-sm font-semibold transition-colors', tone.button)}
        >
          {item.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => dismissToast(item.id)}
        aria-label="Fermer la notification"
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
      {/* Barre de temps : se vide jusqu'à la fermeture, s'arrête pendant le survol. */}
      <span
        aria-hidden="true"
        className={cn('absolute bottom-0 left-0 h-[3px] w-full origin-left', tone.bar)}
        style={{
          animation: `toast-countdown ${item.duration}ms linear forwards`,
          animationPlayState: paused ? 'paused' : 'running',
        }}
      />
    </div>
  )
}

/** Pile des toasts : en haut à droite sur ordinateur, en bas sur téléphone. */
export function Toaster() {
  const items = useSyncExternalStore(subscribeToasts, getToasts, getToasts)
  const pageHidden = usePageHidden()

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col gap-2 sm:inset-x-auto sm:top-4 sm:right-4 sm:bottom-auto sm:w-96"
    >
      {items.map((item) => (
        <Toast key={item.id} item={item} pageHidden={pageHidden} />
      ))}
    </div>
  )
}
