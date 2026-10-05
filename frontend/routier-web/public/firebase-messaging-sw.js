/*
 * Service worker des notifications push Routier+237 (Firebase Cloud Messaging).
 *
 * - Onglet Routier+237 visible : Firebase transmet le message à la page, qui affiche le toast
 *   (aucune notification système ici, donc pas de doublon).
 * - Onglet fermé ou en arrière-plan : ce fichier affiche la notification système.
 *
 * La configuration web Firebase (publique) est passée dans l'URL d'enregistrement
 * (src/lib/push.ts). Aucune clé privée n'est utilisée côté navigateur.
 * La version des scripts doit rester celle du paquet « firebase » de package.json.
 */
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js')

const params = new URL(self.location.href).searchParams

firebase.initializeApp({
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  storageBucket: params.get('storageBucket'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
})

/** Lien interne uniquement (jamais d'ouverture d'un autre site depuis une notification). */
function safeLink(link) {
  return typeof link === 'string' && link.startsWith('/') && !link.startsWith('//') ? link : '/'
}

firebase.messaging().onBackgroundMessage((payload) => {
  const data = payload.data || {}
  if (!data.notification_id) return

  return self.registration.showNotification(data.title || 'Routier+237', {
    body: data.body || '',
    icon: '/favicon.svg',
    // Même identifiant que la notification en base : une notification système par notification.
    tag: data.notification_id,
    data: { link: safeLink(data.link) },
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(safeLink(event.notification.data && event.notification.data.link), self.location.origin).href

  // Onglet déjà ouvert : il est mis au premier plan et ouvre la page lui-même (ce service worker,
  // limité à sa propre portée, ne contrôle pas les pages). Sinon, nouvel onglet.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => client.url.startsWith(self.location.origin))
      if (existing) {
        existing.postMessage({ type: 'routier237:open', link: safeLink(event.notification.data && event.notification.data.link) })
        return existing.focus()
      }
      return self.clients.openWindow(target)
    }),
  )
})
