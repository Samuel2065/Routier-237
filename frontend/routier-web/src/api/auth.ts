import { customerApi, publicApi } from '@/api/client'
import type { AuthPayload, Envelope, Space, User } from '@/types/api'

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

/* Mot de passe oublié ------------------------------------------------------ */

/**
 * Demande d'un lien de réinitialisation. La réponse est la même que le compte existe ou non.
 */
export async function requestPasswordReset(email: string): Promise<string> {
  const { data } = await publicApi.post<{ message: string }>('/auth/forgot-password', { email })
  return data.message
}

export interface ResetPasswordPayload {
  token: string
  email: string
  password: string
  password_confirmation: string
}

/**
 * Nouveau mot de passe depuis le lien reçu par e-mail. Toutes les sessions du compte sont
 * fermées ; « space » indique la page de connexion de la personne.
 */
export async function resetPassword(payload: ResetPasswordPayload): Promise<{ message: string; space: Space }> {
  const { data } = await publicApi.post<{ message: string; space: Space }>('/auth/reset-password', payload)
  return data
}
