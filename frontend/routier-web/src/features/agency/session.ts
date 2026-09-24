import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { fetchAgencyProfile, loginAgency, logoutAgency } from '@/api/agency'
import { useAuthStore, useSession } from '@/store/auth-store'

/**
 * Session de l'espace agence (jeton limité à l'espace « agency »).
 */
export function useAgencyLogin() {
  return useMutation({
    mutationFn: loginAgency,
    onSuccess: (payload) =>
      useAuthStore.getState().setSession('agency', { token: payload.token, expiresAt: payload.expires_at, user: payload.user }),
  })
}

export function useAgencyLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      try {
        await logoutAgency()
      } catch {
        // Session locale fermée dans tous les cas.
      }
    },
    onSettled: () => {
      useAuthStore.getState().clearSession('agency')
      queryClient.removeQueries({ queryKey: ['agency'] })
    },
  })
}

/**
 * Profil à jour (rôle, permissions, périmètre) : rechargé à l'ouverture de l'espace,
 * pour refléter un changement de droits sans reconnexion.
 */
export function useAgencyProfileRefresh() {
  const session = useSession('agency')
  const query = useQuery({ queryKey: ['agency', 'me'], queryFn: fetchAgencyProfile, enabled: !!session, staleTime: 60_000 })

  useEffect(() => {
    if (query.data) useAuthStore.getState().setUser('agency', query.data)
  }, [query.data])

  return query
}

/**
 * Vérification d'une permission pour adapter l'interface (l'API revérifie toujours).
 */
export function useCan() {
  const session = useSession('agency')
  const permissions = session?.user.permissions ?? []

  return (permission: string) => permissions.includes(permission)
}

/**
 * Un director gère plusieurs agences ; le personnel d'agence une seule.
 */
export function useIsMultiAgency(): boolean {
  const session = useSession('agency')
  return !!session && session.user.agency === null
}
