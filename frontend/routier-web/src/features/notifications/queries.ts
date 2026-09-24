import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '@/api/notifications'
import { queryKeys } from '@/lib/query-keys'

export function useNotifications(params: { unread?: boolean; page?: number } = {}, enabled = true) {
  return useQuery({
    queryKey: queryKeys.notifications(params),
    queryFn: () => fetchNotifications(params),
    enabled,
    refetchInterval: 60_000,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notificationsAll }),
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notificationsAll }),
  })
}
