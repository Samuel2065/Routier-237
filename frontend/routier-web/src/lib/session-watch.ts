import type { QueryClient } from '@tanstack/react-query'
import { AUTH_STORAGE_KEY, sessionIdentity, useAuthStore } from '@/store/auth-store'

/**
 * Surveille la session de l'application :
 * - connexion, déconnexion, changement de compte ou session refusée par l'API (401) :
 *   tout le cache des requêtes est vidé, les données d'un compte ne sont jamais
 *   réaffichées au compte suivant ;
 * - autre onglet : une connexion ou déconnexion y est répercutée ici (événement « storage »).
 *
 * Renvoie la fonction d'arrêt de la surveillance.
 */
export function watchSession(queryClient: QueryClient): () => void {
  let identity = sessionIdentity(useAuthStore.getState().sessions)

  const unsubscribe = useAuthStore.subscribe((state) => {
    const next = sessionIdentity(state.sessions)
    if (next === identity) return

    identity = next
    // Supprimer une requête annule aussi son éventuel chargement en cours.
    queryClient.removeQueries()
  })

  const onStorage = (event: StorageEvent) => {
    // key null : stockage vidé dans un autre onglet.
    if (event.key === AUTH_STORAGE_KEY || event.key === null) {
      void useAuthStore.persist.rehydrate()
    }
  }
  window.addEventListener('storage', onStorage)

  return () => {
    unsubscribe()
    window.removeEventListener('storage', onStorage)
  }
}
