import { QueryClient } from '@tanstack/react-query'
import { getStatus } from '@/lib/api-error'

/**
 * Pas de nouvelle tentative sur une erreur client (4xx) : elle se reproduirait à l'identique.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          const status = getStatus(error)
          if (status !== undefined && status >= 400 && status < 500) return false
          return failureCount < 2
        },
      },
      mutations: { retry: false },
    },
  })
}
