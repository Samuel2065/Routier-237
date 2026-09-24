/**
 * Attributs ARIA d'un contrôle de formulaire relié à son aide et à son message d'erreur
 * (identifiants générés par FormField).
 */
export function fieldAria(id: string, error?: string, hint?: string) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy }
}
