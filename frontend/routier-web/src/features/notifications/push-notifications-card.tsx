import { BellOff, BellRing, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { disablePush, enablePush, isOptedIn, pushConfigured, pushSupport, type PushSupport } from '@/lib/push'
import type { Space } from '@/types/api'

type CardState = PushSupport | 'checking' | 'off' | 'on' | 'denied'

const MESSAGES: Partial<Record<CardState, string>> = {
  off: 'Recevez une alerte sur cet appareil même lorsque Routier+237 est fermé ou en arrière-plan. Votre navigateur vous demandera votre accord ; vous pourrez désactiver à tout moment.',
  on: 'Activées sur cet appareil : vous êtes alerté même lorsque Routier+237 est fermé.',
  denied:
    'Les notifications sont bloquées pour ce site dans votre navigateur. Pour les autoriser : cliquez sur le cadenas à gauche de l\'adresse du site, choisissez « Notifications : Autoriser », puis rechargez la page.',
  unsupported:
    'Ce navigateur ne permet pas les notifications push. Sur iPhone ou iPad (iOS 16.4 ou plus récent), ajoutez d\'abord le site à l\'écran d\'accueil. Vos notifications restent visibles ici.',
  insecure: 'Les notifications push exigent une connexion sécurisée (HTTPS). Vos notifications restent visibles ici.',
}

/**
 * Activation des notifications push sur cet appareil, pour le compte connecté. La permission
 * du navigateur n'est demandée qu'après un clic, jamais au chargement de la page.
 */
export function PushNotificationsCard({ space, userId }: { space: Space; userId: number }) {
  const [state, setState] = useState<CardState>('checking')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    pushSupport()
      .then((support) => {
        if (cancelled) return
        if (support !== 'ok') return setState(support)
        if (Notification.permission === 'denied') return setState('denied')
        setState(Notification.permission === 'granted' && isOptedIn(space, userId) ? 'on' : 'off')
      })
      .catch(() => !cancelled && setState('unsupported'))
    return () => {
      cancelled = true
    }
  }, [space, userId])

  // Push non configuré (variables VITE_FIREBASE_* absentes) : rien à proposer.
  if (!pushConfigured || state === 'unconfigured' || state === 'checking') return null

  const run = async (action: () => Promise<CardState>) => {
    setPending(true)
    setError(null)
    try {
      setState(await action())
    } catch {
      setError('L\'opération n\'a pas abouti. Vérifiez votre connexion puis réessayez.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        {state === 'on' ? (
          <BellRing className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        ) : (
          <BellOff className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <div className="grid gap-1">
          <p className="text-sm font-medium">Notifications sur cet appareil</p>
          <p className="text-sm text-muted-foreground">{MESSAGES[state]}</p>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
      {state === 'off' && (
        <Button
          className="shrink-0"
          disabled={pending}
          onClick={() => run(async () => ((await enablePush(space, userId)) === 'granted' ? 'on' : Notification.permission === 'denied' ? 'denied' : 'off'))}
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <BellRing aria-hidden="true" />}
          Activer
        </Button>
      )}
      {state === 'on' && (
        <Button
          variant="outline"
          className="shrink-0"
          disabled={pending}
          onClick={() =>
            run(async () => {
              await disablePush(space, userId)
              return 'off'
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <BellOff aria-hidden="true" />}
          Désactiver
        </Button>
      )}
    </div>
  )
}
