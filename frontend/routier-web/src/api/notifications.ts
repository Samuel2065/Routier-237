import { customerApi } from '@/api/client'
import type { NotificationPage } from '@/types/api'

export async function fetchNotifications(params: { unread?: boolean; page?: number } = {}): Promise<NotificationPage> {
  const { data } = await customerApi.get<NotificationPage>('/account/notifications', {
    params: { page: params.page, unread: params.unread ? 1 : undefined },
  })
  return data
}

export async function markNotificationRead(id: string): Promise<void> {
  await customerApi.post(`/account/notifications/${id}/read`)
}

export async function markAllNotificationsRead(): Promise<void> {
  await customerApi.post('/account/notifications/read-all')
}
