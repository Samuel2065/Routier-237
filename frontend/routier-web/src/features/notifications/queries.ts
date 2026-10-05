import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationSpace,
} from '@/api/notifications'
import { queryKeys } from '@/lib/query-keys'
import { useLiveFallbackInterval } from '@/lib/realtime'

/**
 * Centre de notifications d'un espace (client ou agence). L'API reste la source de vérité :
 * lu, tout lu et suppression sont enregistrés côté serveur, puis la liste est relue.
 */
export function useNotifications(space: NotificationSpace, params: { unread?: boolean; page?: number } = {}, enabled = true) {
  return useQuery({
    queryKey: queryKeys.spaceNotifications(space, params),
    queryFn: () => fetchNotifications(space, params),
    enabled,
    refetchInterval: useLiveFallbackInterval(),
  })
}

function useNotificationMutation<T>(space: NotificationSpace, mutationFn: (variables: T) => Promise<void>) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.spaceNotificationsAll(space) }),
  })
}

export function useMarkNotificationRead(space: NotificationSpace) {
  return useNotificationMutation(space, (id: string) => markNotificationRead(space, id))
}

export function useMarkAllNotificationsRead(space: NotificationSpace) {
  return useNotificationMutation(space, () => markAllNotificationsRead(space))
}

export function useDeleteNotification(space: NotificationSpace) {
  return useNotificationMutation(space, (id: string) => deleteNotification(space, id))
}
