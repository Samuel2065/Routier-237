/**
 * Règles de saisie communes, alignées sur la validation de l'API (qui reste seule juge).
 */

/** Numéro camerounais : 9 chiffres commençant par 2 ou 6, préfixe +237 facultatif. */
export const PHONE_REGEX = /^(\+237)?[26]\d{8}$/

/** Retire espaces, points et tirets (« 699 11-22.33 » → « 699112233 »). */
export function normalizePhone(value: string): string {
  return value.replace(/[\s.-]/g, '')
}

export function isValidPhone(value: string): boolean {
  return PHONE_REGEX.test(normalizePhone(value))
}

/**
 * Chemin de redirection interne sûr (évite les redirections ouvertes vers un autre site).
 */
export function safeRedirect(value: string | null | undefined, fallback = '/account'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback
  }
  return value
}
