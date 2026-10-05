import { agencyApi, customerApi } from '@/api/client'
import type { NotificationPage } from '@/types/api'

/** Espaces disposant d'un centre de notifications. */
export type NotificationSpace = 'customer' | 'agency'

const endpoints = {
  customer: { api: customerApi, base: '/account/notifications' },
  agency: { api: agencyApi, base: '/agency/notifications' },
} as const

export async function fetchNotifications(space: NotificationSpace, params: { unread?: boolean; page?: number } = {}): Promise<NotificationPage> {
  const { api, base } = endpoints[space]
  const { data } = await api.get<NotificationPage>(base, {
    params: { page: params.page, unread: params.unread ? 1 : undefined },
  })
  return data
}

export async function markNotificationRead(space: NotificationSpace, id: string): Promise<void> {
  const { api, base } = endpoints[space]
  await api.post(`${base}/${id}/read`)
}

export async function markAllNotificationsRead(space: NotificationSpace): Promise<void> {
  const { api, base } = endpoints[space]
  await api.post(`${base}/read-all`)
}

export async function deleteNotification(space: NotificationSpace, id: string): Promise<void> {
  const { api, base } = endpoints[space]
  await api.delete(`${base}/${id}`)
}
