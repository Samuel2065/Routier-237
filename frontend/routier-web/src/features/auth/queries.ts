import { useMutation, useQueryClient } from '@tanstack/react-query'
import { loginCustomer, logoutCustomer, registerCustomer, type LoginPayload, type RegisterPayload } from '@/api/auth'
import { useAuthStore } from '@/store/auth-store'
import type { AuthPayload } from '@/types/api'

function storeCustomerSession(payload: AuthPayload) {
  useAuthStore.getState().setSession('customer', {
    token: payload.token,
    expiresAt: payload.expires_at,
    user: payload.user,
  })
}

export function useCustomerLogin() {
  return useMutation({
    mutationFn: (payload: LoginPayload) => loginCustomer(payload),
    onSuccess: storeCustomerSession,
  })
}

export function useCustomerRegister() {
  return useMutation({
    mutationFn: (payload: RegisterPayload) => registerCustomer(payload),
    onSuccess: storeCustomerSession,
  })
}

/**
 * Déconnexion : révoque le jeton côté API puis ferme la session locale,
 * même si l'API est injoignable (le jeton expirera de lui-même).
 */
export function useCustomerLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      try {
        await logoutCustomer()
      } catch {
        // Session locale fermée dans tous les cas.
      }
    },
    onSettled: () => {
      useAuthStore.getState().clearSession('customer')
      queryClient.removeQueries({ queryKey: ['account'] })
    },
  })
}
