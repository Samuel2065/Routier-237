import type { ReactNode } from 'react'

export type ToastTone = 'success' | 'error' | 'warning' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  /** Même identifiant = même toast (remplacé, jamais doublé). */
  id?: string | number
  description?: string
  icon?: ReactNode
  action?: ToastAction
  duration?: number
}

export interface ToastItem {
  id: string
  tone: ToastTone
  title: string
  description?: string
  icon?: ReactNode
  action?: ToastAction
  /** Durée d'affichage (ms) ; la barre de temps se vide en autant de temps. */
  duration: number
  /** Animation de sortie en cours avant le retrait. */
  leaving: boolean
}

/** Les erreurs restent plus longtemps : elles demandent souvent d'être lues. */
export const TOAST_DURATIONS: Record<ToastTone, number> = { success: 4_000, info: 6_000, warning: 7_000, error: 8_000 }

/** Durée de l'animation de sortie (voir `toast-out` dans index.css). */
export const TOAST_EXIT_MS = 220

/** Au-delà, les plus anciens toasts laissent la place. */
const MAX_VISIBLE = 4

let toasts: ToastItem[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function subscribeToasts(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getToasts(): ToastItem[] {
  return toasts
}

/** Lance l'animation de sortie puis retire le toast. */
export function dismissToast(id: string) {
  if (!toasts.some((item) => item.id === id && !item.leaving)) return

  toasts = toasts.map((item) => (item.id === id ? { ...item, leaving: true } : item))
  emit()
  window.setTimeout(() => {
    toasts = toasts.filter((item) => item.id !== id)
    emit()
  }, TOAST_EXIT_MS)
}

function show(tone: ToastTone, title: string, options: ToastOptions = {}): string {
  const id = options.id !== undefined ? String(options.id) : `toast-${nextId++}`

  // Le même message deux fois de suite (double clic…) n'est affiché qu'une fois.
  const last = toasts.at(-1)
  if (options.id === undefined && last && !last.leaving && last.tone === tone && last.title === title && last.description === options.description) {
    return last.id
  }

  const item: ToastItem = {
    id,
    tone,
    title,
    description: options.description,
    icon: options.icon,
    action: options.action,
    duration: options.duration ?? TOAST_DURATIONS[tone],
    leaving: false,
  }

  toasts = [...toasts.filter((existing) => existing.id !== id), item].slice(-MAX_VISIBLE)
  emit()
  return id
}

/**
 * Toasts de l'application, utilisables partout (composants, gestionnaires TanStack Query) :
 * `toast.success('Trajet publié.')`, `toast.error(message)`, `toast(titre, { description, action })`.
 */
export const toast = Object.assign((title: string, options?: ToastOptions) => show('info', title, options), {
  success: (title: string, options?: ToastOptions) => show('success', title, options),
  error: (title: string, options?: ToastOptions) => show('error', title, options),
  warning: (title: string, options?: ToastOptions) => show('warning', title, options),
  info: (title: string, options?: ToastOptions) => show('info', title, options),
  dismiss: dismissToast,
})
