import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { RouterProvider } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { createQueryClient } from '@/lib/query-client'
import { watchSession } from '@/lib/session-watch'
import { router } from '@/routes/router'

export default function App() {
  const [queryClient] = useState(createQueryClient)

  // Cache vidé à chaque changement de compte, sessions synchronisées entre onglets.
  useEffect(() => watchSession(queryClient), [queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors closeButton />
    </QueryClientProvider>
  )
}
