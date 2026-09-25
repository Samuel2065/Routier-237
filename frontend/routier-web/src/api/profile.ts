import type { AxiosInstance } from 'axios'
import { adminApi, agencyApi, customerApi } from '@/api/client'
import type { Envelope, Space, User } from '@/types/api'

const CLIENTS: Record<Space, AxiosInstance> = { customer: customerApi, agency: agencyApi, admin: adminApi }

/** Photo de profil du compte connecté dans l'espace donné. */
export async function uploadAvatar(space: Space, file: File): Promise<User> {
  const form = new FormData()
  form.append('avatar', file)
  const { data } = await CLIENTS[space].post<Envelope<User>>('/auth/me/avatar', form)
  return data.data
}

export async function deleteAvatar(space: Space): Promise<User> {
  const { data } = await CLIENTS[space].delete<Envelope<User>>('/auth/me/avatar')
  return data.data
}
