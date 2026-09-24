import { customerApi, publicApi } from '@/api/client'
import type { AuthPayload, Envelope, User } from '@/types/api'

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  name: string
  email: string
  phone?: string | null
  password: string
  password_confirmation: string
}

const DEVICE_NAME = 'routier-web'

export async function loginCustomer(payload: LoginPayload): Promise<AuthPayload> {
  const { data } = await publicApi.post<Envelope<AuthPayload>>('/auth/login', { ...payload, device_name: DEVICE_NAME })
  return data.data
}

export async function registerCustomer(payload: RegisterPayload): Promise<AuthPayload> {
  const { data } = await publicApi.post<Envelope<AuthPayload>>('/auth/register', { ...payload, device_name: DEVICE_NAME })
  return data.data
}

export async function fetchCustomerProfile(): Promise<User> {
  const { data } = await customerApi.get<Envelope<User>>('/auth/me')
  return data.data
}

export async function logoutCustomer(): Promise<void> {
  await customerApi.post('/auth/logout')
}
