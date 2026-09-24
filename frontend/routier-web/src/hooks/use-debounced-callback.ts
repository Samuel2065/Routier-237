import { useEffect, useRef } from 'react'

/**
 * Retarde un appel (ex. recherche au fil de la saisie) pour limiter les requêtes.
 */
export function useDebouncedCallback<Args extends unknown[]>(callback: (...args: Args) => void, delay = 300) {
  const timer = useRef<number | undefined>(undefined)
  const latest = useRef(callback)

  useEffect(() => {
    latest.current = callback
  }, [callback])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (...args: Args) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => latest.current(...args), delay)
  }
}
