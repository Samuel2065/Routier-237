import type { FirebaseApp } from 'firebase/app'
import type { Messaging } from 'firebase/messaging'
import { adminApi, agencyApi, customerApi } from '@/api/client'
import type { Space } from '@/types/api'

/**
 * Notifications push du navigateur (Firebase Cloud Messaging).
 *
 * La configuration ci-dessous est publique (identifiants de l'application web Firebase et
 * clé VAPID publique) ; la clé privée du compte de service reste exclusivement sur le serveur.
 * Le SDK Firebase n'est chargé qu'à la première utilisation.
 *
 * Inscription d'un appareil : uniquement après un clic de l'utilisateur (« Activer »), pour
 * son compte ; le choix est mémorisé par compte sur cet appareil. Le jeton est renvoyé à
 * l'API à chaque ouverture de l'espace (renouvellement, reconnexion), et l'API le supprime
 * avec la session (déconnexion) ou quand Firebase le déclare invalide.
 */

const env = import.meta.env
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
}
const VAPID_KEY = env.VITE_FIREBASE_VAPID_KEY as string | undefined

export const pushConfigured = !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId && VAPID_KEY)

/** Portée dédiée : le service worker ne contrôle pas les pages de l'application. */
const SW_SCOPE = '/firebase-cloud-messaging-push-scope'
const OPT_IN_KEY = 'routier237-push-accounts'

/** Émis quand ce compte active ou désactive le push sur cet appareil. */
export const PUSH_CHANGED_EVENT = 'routier237:push-changed'

const apiBySpace = { customer: customerApi, agency: agencyApi, admin: adminApi }

export type PushSupport = 'ok' | 'unconfigured' | 'insecure' | 'unsupported'

export async function pushSupport(): Promise<PushSupport> {
  if (!pushConfigured) return 'unconfigured'
  if (typeof window === 'undefined' || !window.isSecureContext) return 'insecure'
  if (!('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) return 'unsupported'

  const { isSupported } = await import('firebase/messaging')
  return (await isSupported()) ? 'ok' : 'unsupported'
}

/* Choix de l'utilisateur, mémorisé par compte sur cet appareil -------------------------- */

function accountKey(space: Space, userId: number): string {
  return `${space}:${userId}`
}

function optedInAccounts(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(OPT_IN_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function setOptIn(space: Space, userId: number, enabled: boolean) {
  const key = accountKey(space, userId)
  const accounts = optedInAccounts().filter((item) => item !== key)
  try {
    localStorage.setItem(OPT_IN_KEY, JSON.stringify(enabled ? [...accounts, key] : accounts))
  } catch {
    // Stockage indisponible (navigation privée stricte) : le choix ne sera pas mémorisé.
  }
}

export function isOptedIn(space: Space, userId: number): boolean {
  return optedInAccounts().includes(accountKey(space, userId))
}

/* Firebase ------------------------------------------------------------------------------- */

let messagingPromise: Promise<Messaging> | null = null

function getFirebaseMessaging(): Promise<Messaging> {
  messagingPromise ??= Promise.all([import('firebase/app'), import('firebase/messaging')]).then(([app, messaging]) => {
    const firebaseApp: FirebaseApp = app.getApps()[0] ?? app.initializeApp(firebaseConfig)
    return messaging.getMessaging(firebaseApp)
  })
  return messagingPromise
}

async function serviceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  const params = new URLSearchParams(Object.entries(firebaseConfig).filter((entry): entry is [string, string] => !!entry[1]))
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params}`, { scope: SW_SCOPE })
}

async function currentToken(): Promise<string> {
  const [{ getToken }, messaging, registration] = await Promise.all([import('firebase/messaging'), getFirebaseMessaging(), serviceWorkerRegistration()])
  return getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
}

async function registerOnServer(space: Space): Promise<void> {
  const token = await currentToken()
  await apiBySpace[space].post('/auth/push-tokens', { token })
}

/**
 * Active le push sur cet appareil pour ce compte. La permission du navigateur n'est demandée
 * qu'ici, à la suite d'un clic de l'utilisateur.
 */
export async function enablePush(space: Space, userId: number): Promise<NotificationPermission> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission

  await registerOnServer(space)
  setOptIn(space, userId, true)
  window.dispatchEvent(new Event(PUSH_CHANGED_EVENT))
  return permission
}

/**
 * Désactive le push sur cet appareil pour ce compte (le jeton est retiré côté serveur puis chez Firebase).
 */
export async function disablePush(space: Space, userId: number): Promise<void> {
  setOptIn(space, userId, false)
  const [{ deleteToken }, messaging] = await Promise.all([import('firebase/messaging'), getFirebaseMessaging()])
  const token = await currentToken()
  await apiBySpace[space].delete('/auth/push-tokens', { data: { token } })
  await deleteToken(messaging)
  window.dispatchEvent(new Event(PUSH_CHANGED_EVENT))
}

/**
 * À l'ouverture d'un espace : si ce compte a activé le push ici et que la permission est
 * toujours accordée, renvoie le jeton (éventuellement renouvelé) à l'API.
 */
export async function syncPush(space: Space, userId: number): Promise<boolean> {
  if (!isOptedIn(space, userId) || (await pushSupport()) !== 'ok' || Notification.permission !== 'granted') return false

  await registerOnServer(space)
  return true
}

/**
 * Message reçu alors que l'onglet est au premier plan (pas de notification système) :
 * l'appelant relit le centre de notifications, qui affiche le toast une seule fois.
 */
export async function onForegroundPush(callback: () => void): Promise<() => void> {
  const [{ onMessage }, messaging] = await Promise.all([import('firebase/messaging'), getFirebaseMessaging()])
  return onMessage(messaging, () => callback())
}

/**
 * Clic sur une notification système alors qu'un onglet est ouvert : le service worker
 * demande à l'onglet d'ouvrir la page liée (chemin interne uniquement).
 */
export function onPushNotificationClick(open: (link: string) => void): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => {}

  const listener = (event: MessageEvent) => {
    const link = event.data?.type === 'routier237:open' ? event.data.link : null
    if (typeof link === 'string' && link.startsWith('/') && !link.startsWith('//')) open(link)
  }
  navigator.serviceWorker.addEventListener('message', listener)
  return () => navigator.serviceWorker.removeEventListener('message', listener)
}
