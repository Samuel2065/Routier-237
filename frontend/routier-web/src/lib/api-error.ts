import { isAxiosError } from 'axios'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

/**
 * Message d'erreur lisible à partir d'une erreur d'API (messages déjà en français côté Laravel).
 */
export function getErrorMessage(error: unknown, fallback = 'Une erreur est survenue. Veuillez réessayer.'): string {
  if (isAxiosError(error)) {
    if (!error.response) {
      return 'Impossible de joindre le serveur. Vérifiez votre connexion internet.'
    }
    if (error.response.status === 429) {
      return 'Trop de tentatives. Patientez un instant avant de réessayer.'
    }
    const message = (error.response.data as { message?: unknown } | undefined)?.message
    if (typeof message === 'string' && message.trim() !== '' && error.response.status < 500) {
      return message
    }
    if (error.response.status >= 500 && error.response.status !== 503) {
      return fallback
    }
    if (typeof message === 'string' && message.trim() !== '') {
      return message
    }
  }
  return fallback
}

export function getStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined
}

/**
 * Erreurs de validation Laravel (422) : premier message par champ.
 */
export function getFieldErrors(error: unknown): Record<string, string> {
  if (!isAxiosError(error) || error.response?.status !== 422) {
    return {}
  }
  const errors = (error.response.data as { errors?: Record<string, string[]> } | undefined)?.errors ?? {}
  return Object.fromEntries(
    Object.entries(errors)
      .filter(([, messages]) => Array.isArray(messages) && messages.length > 0)
      .map(([field, messages]) => [field, messages[0]]),
  )
}

/**
 * Reporte les erreurs de validation du serveur sur les champs du formulaire.
 * Retourne true si au moins une erreur a été associée à un champ.
 */
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>): boolean {
  const fieldErrors = getFieldErrors(error)
  for (const [field, message] of Object.entries(fieldErrors)) {
    setError(field as Path<T>, { type: 'server', message })
  }
  return Object.keys(fieldErrors).length > 0
}
