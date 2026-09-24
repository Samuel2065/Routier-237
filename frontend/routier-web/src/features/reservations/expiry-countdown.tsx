import { Timer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/**
 * Temps restant pour payer une réservation en attente (ses places sont bloquées jusque-là).
 */
export function ExpiryCountdown({ expiresAt, onExpire }: { expiresAt: string; onExpire?: () => void }) {
  const deadline = new Date(expiresAt).getTime()
  const [now, setNow] = useState(() => Date.now())
  const remaining = Math.max(0, deadline - now)
  const expired = remaining === 0

  const onExpireRef = useRef(onExpire)
  useEffect(() => {
    onExpireRef.current = onExpire
  }, [onExpire])

  useEffect(() => {
    if (expired) {
      onExpireRef.current?.()
      return
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [expired])

  const minutes = Math.floor(remaining / 60_000)
  const seconds = Math.floor((remaining % 60_000) / 1000)

  return (
    <p className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-800" role="timer" aria-live="off">
      <Timer className="size-4" aria-hidden="true" />
      {expired ? 'Le délai de paiement est dépassé.' : `Places réservées pendant encore ${minutes}:${String(seconds).padStart(2, '0')}`}
    </p>
  )
}
