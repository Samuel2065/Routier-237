# Routier+237 — Point de reprise (29/10/2026)

Document de passation pour reprendre le travail dans une nouvelle session sans perte de contexte.
Référence fonctionnelle : **Cahier des charges Routier+237 v1.0** (PDF fourni par le client).
Toutes les décisions détaillées sont dans le [README.md](README.md) (sections « Décisions et hypothèses »).

## 1. Règles de travail imposées par le client (à respecter strictement)

- Répondre et documenter **en français**.
- **Une étape à la fois**, puis **s'arrêter** et demander au client de tester et valider avant de continuer.
- **Lire le code existant et le README avant toute modification** ; ne pas réinventer ni disperser le système.
- Pas de changement de stack, pas de sur-ingénierie, pas de nouvelle table sans nécessité.
- **Ne rien inventer** : aucune statistique, aucun avis, aucune notification, aucune page fictive.
- **Paiements : simulation uniquement** (`PAYMENT_DEFAULT_DRIVER=mock`) en attendant les identifiants
  Orange Money / MTN MoMo / carte. Ne pas proposer de changer cela. La simulation est refusée
  uniquement quand `APP_ENV=production` (règle existante du module 8).
- Ne jamais affirmer qu'un test a réussi sans l'avoir exécuté. Pas de commit ni de push sans accord.

## 2. Architecture

```
frontend/routier-web  React 19 + TS + Vite + Tailwind 4 + shadcn/ui (Lucide) + React Router 7
                      + Axios + TanStack Query + Zustand + React Hook Form + Zod + Vitest
backend/routier-api   Laravel 12, PHP 8.2, MySQL/MariaDB (XAMPP), Sanctum (jetons Bearer),
                      Spatie Permission
```

- Un jeton Sanctum = un espace (`customer`, `agency`, `admin`) ; middleware `space`.
- Autorisation = permission Spatie + périmètre (policies, `accessibleBy()`).
- Bases : `routier237_v1` (dev) et `routier237_v1_testing` (tests, voir `phpunit.xml`).

## 3. Avancement

### Modules 0 à 12 du cahier des charges : TERMINÉS (commit `26082fd`)

Décision validée par le client : **seul le comptable (accountant)** peut rembourser
(`payments.refund`) ; le director ne rembourse pas.

### Refonte de l'interface : TERMINÉE ET COMMITÉE

Commits `a0063d0` (tableaux de bord, photo de profil, page d'accueil) et `0a84f37`
(« Personnel actif » du super-admin, bloc `active_staff` de `GET /api/v1/admin/dashboard`).
`main` est à jour avec `gitlab/main` (04/10/2026). Les PNG originaux de `src/assets/` ne sont pas
suivis par Git ; seules les copies WebP de `src/assets/landing/` le sont.

## 4. Chantier en cours (depuis le 04/10/2026) : sécurité, temps réel, notifications/FCM, Super Admin

Source : prompt client `prompt_routier237_securite_temps_reel_firebase_superadmin.md`.
Ordre imposé : Phase 0 audit → 1 sécurité → 2 données actualisées → 3 notifications + Firebase →
4 Super Admin. **Une phase à la fois, tests exécutés, compte rendu (Résumé / Problèmes / Modifications /
Vérifications / Ce que je dois tester / État), puis arrêt pour feu vert.** Le client débute avec
Firebase/temps réel : expliquer simplement. Ne jamais demander ni afficher de clé privée ou de fichier
de compte de service Firebase. Pas de dépendance ni de migration sans justification.

| Phase | Contenu | Statut |
|---|---|---|
| 0 | Audit sans modification + plan | ✅ validé (diagnostic confirmé par le client) |
| 1 | Sécurité et séparation des accès | ✅ validé par le client, commit `49f7584` (GitLab + GitHub) |
| 2 | Données React actualisées sans rechargement (Reverb) | ✅ commit `232534b` (GitLab + GitHub) |
| 3 | Toasts, centre de notifications, Firebase Cloud Messaging | ✅ commit `7c4b26f` (GitLab + GitHub) |
| 4 | Fonctionnalités Super Admin | ✅ commit `cd2a96b` (GitLab ; GitHub à pousser) |

### Constats de la Phase 0 (aucun code modifié)

**Backend (solide)** : chaque route privée = `auth:sanctum` + `space:<espace>` + throttle ; le jeton
porte l'ability de son espace ; `canEnterSpace()` revérifie rôle + statut à chaque requête ; chaque
action passe par une policy (`Gate::authorize` ou `authorize()` des Form Requests) ; listes filtrées
par `accessibleBy()` ; un `agency_id` envoyé par le client est vérifié. Aucun trou d'accès trouvé.
Faiblesses : (a) `SpaceSeparationTest` utilise des routes factices (`/api/test-space/*`), pas les
vraies routes ; (b) `config/sanctum.php` garde `'guard' => ['web']` : si une session web existait un
jour, Sanctum fournirait un `TransientToken` dont `can()` vaut toujours vrai (défense en profondeur).

**Cause probable du problème signalé (« un client accède à l'espace agence »)** — frontend :
`src/store/auth-store.ts` conserve **plusieurs sessions simultanées** (client, agence, admin) dans
`localStorage` pendant 7 jours. Se connecter en client ne ferme pas une session agence ouverte avant
dans le même navigateur ; le lien « Espace agence » du pied de page mène à `/agency/login`, qui
redirige directement vers le tableau de bord (`pages/agency/login-page.tsx`) avec le jeton de
l'employé précédent. Les gardes (`require-agency.tsx`, `require-admin.tsx`, `require-customer.tsx`)
ne vérifient que la présence d'une session, pas le rôle. Les déconnexions ne vident que le cache de
leur espace ; pas de synchronisation entre onglets. Clé de cache publique `['agency', id]` qui
partage le préfixe de l'espace agence `['agency', …]`.

**Temps réel** : aucun (pas de Broadcasting/Reverb/Echo/Pusher, `BROADCAST_CONNECTION=log`, pas de
`config/broadcasting.php`). TanStack Query : `refetchInterval` 60 s (tableaux de bord agence/admin,
notifications client), interrogation 3 s du paiement en cours, `refetchOnWindowFocus: false`,
`staleTime` 30 s, invalidations après mutations.

**Places / anti-surbooking** : calcul serveur (`CreateReservation`, `SELECT … FOR UPDATE`, test de
concurrence réel). Correct.

**Notifications** : table `notifications` Laravel (canaux `database` + `mail`), **clients
uniquement** (réservation confirmée/annulée, paiement échoué), endpoints `account/notifications*`.
Rien pour le personnel ni l'admin. `sonner` (toasts) déjà installé. **Firebase / FCM : absent.**

**Super Admin** : tableau de bord global (+ personnel actif), organisations, agences, directeurs,
villes, itinéraires, utilisateurs (liste/filtres/détail, suspendre/réactiver, jetons révoqués).
Manquent : changement de rôle (décision module 11 : non en V1, à reconfirmer), réinitialisation de
mot de passe (table `password_reset_tokens` présente mais inutilisée), vues globales
trajets/réservations/paiements, journal d'audit. Le mot de passe n'est jamais renvoyé.

**Tests de référence (04/10/2026)** : backend `php artisan test` 154 OK (1712 assertions) ;
frontend `npm test` 52 OK ; `npm run lint` OK.

### Phase 1 — réalisée (04/10/2026, non commitée)

Le client a reproduit le bug (même navigateur : client connecté après un employé → espace agence
ouvert). Décision appliquée : **une seule session par navigateur** (recommandation acceptée en lançant
la phase). Détails dans le README, « Décisions et hypothèses (sécurité — phase 1) ».

- Backend : `config/sanctum.php` `guard => []` ; `app/Enums/AccessSpace.php` (`fromToken` n'accepte
  qu'un `PersonalAccessToken`) ; nouveaux tests `tests/Feature/Security/RouteAccessMatrixTest.php`
  (toutes les vraies routes privées : invité 401, autre espace 403 ; espace attendu déduit du préfixe
  d'URL, vérifié par mutation : ouvrir `space:agency` aux clients fait échouer le test) et
  `ResourceIsolationTest.php` (IDOR par HTTP) ; `SpaceSeparationTest` + test `TransientToken`.
  Aucune migration, aucune dépendance.
- Frontend : `src/store/auth-store.ts` (session unique, `SPACE_ROLES`, `isSessionValid(space, …)`
  vérifie le rôle, stockage version 1 qui vide un ancien stockage multi-sessions, `sessionIdentity`) ;
  `src/lib/session-watch.ts` (vide tout le cache TanStack quand le jeton change, synchro entre onglets
  via l'événement `storage`) branché dans `App.tsx` ; `src/api/client.ts` (`endsSession` : 401,
  « Votre accès est désactivé. », « Accès non autorisé depuis cet espace. ») ; déconnexions simplifiées
  (`features/auth/queries.ts`, `features/agency/session.ts`, `features/admin/queries.ts`) ;
  `lib/query-keys.ts` (profil public d'agence → `['public-agency', …]`). Tests :
  `store/auth-store.test.ts`, `lib/session-watch.test.ts`, `features/auth/route-guards.test.tsx`
  (le scénario signalé échoue avec l'ancien code, vérifié par mutation).
- Résultats : backend 162 tests OK (2204 assertions), Pint OK ; frontend 68 tests OK (19 fichiers),
  lint OK, build OK (132,5 Ko gzip).

Phase 1 validée par le client et commitée : `49f7584`, poussée sur GitLab (`gitlab`) et GitHub (`origin`).

### Phase 2 — réalisée et commitée (04/10/2026, commit `232534b`, GitLab + GitHub)

Choix du client : **Laravel Reverb + Echo** ; hébergement prévu **Hostinger avec SSH** (Reverb exige
un VPS : processus permanent + proxy wss ; sur mutualisé → `BROADCAST_CONNECTION=null`, repli par
interrogation). Détails : README « Décisions et hypothèses (temps réel — phase 2) ».

- Dépendances : `laravel/reverb` ^1.12 (composer) ; `laravel-echo` ^2.5 et `pusher-js` ^8.6 (npm,
  chargés à la demande). Aucune migration. `npm audit` signale `braces` via `shadcn` : préexistant.
- Backend : `app/Events/LiveUpdate.php` (signal `live.update`, ShouldBroadcastNow, sujets + ids) ;
  `app/Support/LiveUpdates.php` (collecte après commit, un signal par canal, envoi en fin de requête,
  échec journalisé sans bloquer) ; observateurs + `terminating` dans `AppServiceProvider` ;
  signaux explicites dans `ExpirePendingReservations` et `CompletePastTrips` ; `routes/channels.php`
  (agency.{id}, organization.{id}, user.{id}, admin ; espace du jeton vérifié) ; `bootstrap/app.php`
  `withBroadcasting` → `POST /api/broadcasting/auth` (auth:sanctum + space) ; `config/broadcasting.php`
  (timeouts 1–2 s), `config/reverb.php` (origines = hôtes de FRONTEND_URL, pas de whisper) ;
  `.env.example` (bloc Reverb sans secret, `BROADCAST_CONNECTION=null` par défaut) ; `phpunit.xml`
  (`BROADCAST_CONNECTION=null`) ; `routier:check-production` contrôle Reverb/HTTPS.
  `.env` local : Reverb activé avec identifiants générés (non affichés, non commités).
- Frontend : `src/lib/realtime.ts` (Echo à la demande, autorisation via le client HTTP de l'espace,
  état de connexion, `useLiveFallbackInterval`) ; `src/features/realtime/live-updates.ts`
  (`useLiveUpdates`, `queryKeysFor`, regroupement 250 ms, rechargement après coupure) ; branché dans
  `customer-layout`, `agency-layout` (`agencyLiveChannel` dans `features/agency/session.ts`),
  `admin-layout`, et pages publiques search/trip/booking/agency (canal `trips`) ; interrogation de
  secours 60 s seulement hors connexion temps réel ; `.env.example` (VITE_REVERB_*) ;
  `vite.config.ts` (tests sans temps réel).
- Tests : `tests/Feature/Realtime/LiveUpdatesTest.php` (7) ; `src/features/realtime/live-updates.test.tsx` (10).
  Vérification réelle : Reverb démarre sous Windows ; un client WebSocket reçoit
  `{"topics":["availability"],"ids":{"trip":[7]}}` après modification d'un trajet ; origine étrangère
  et canal privé non signé refusés ; le navigateur du client s'abonnait déjà à `private-agency.1`.
- Résultats : backend 169 tests OK (2247 assertions), Pint OK ; frontend 78 tests OK (20 fichiers),
  lint OK, build OK (index 132,6 Ko gzip ; echo 2,8 Ko et pusher 18,1 Ko chargés à la demande).

### Phase 3 — en cours (découpée en 3a puis 3b)

**3a — notifications, centre et toasts : réalisée (04/10/2026, non commitée).** Détails : README
« Décisions et hypothèses (notifications — phase 3a) ».

- Backend : `app/Notifications/StaffReservationAlert.php` (alertes personnel : confirmée →
  reservations.view ; annulée par le client → reservations.view, « Paiement à rembourser » si payée ;
  paiement tardif → payments.refund ; envoi protégé par `rescue`) ; appelée dans
  `Actions/Payments/ApplyPaymentResult.php` et `Account/ReservationController::cancel` ;
  contrôleur déplacé en `Http/Controllers/Api/V1/NotificationController.php` (+ `destroy`), routes
  partagées `$notificationRoutes` dans `routes/api.php` (account/* et agency/*) ;
  `routes/channels.php` : `user.{id}` ouvert au compte lui-même depuis tout espace.
  Pas d'alerte admin (aucun événement pertinent pour l'instant). Aucune migration ni dépendance.
- Frontend : `api/notifications.ts` (par espace + suppression), `features/notifications/queries.ts`
  (par espace), `notification-meta.ts` (titres, liens, `freshNotifications`), `notification-list.tsx`
  (titre, lien, supprimer), `notification-toasts.tsx` (canal personnel + toasts sonner dédupliqués
  par id), branché dans `customer-layout`, `agency-layout` (cloche + menu), `public-layout` (client
  connecté) ; page `pages/agency/notifications-page.tsx` + route `/agency/notifications` ;
  `lib/realtime.ts` (`user.*` autorisé avec la session ouverte) ; `live-updates.ts` (sujet
  notifications côté agence) ; types `NotificationType`.
- Tests : `tests/Feature/Notifications/StaffNotificationTest.php` (4) ; `notifications.test.tsx` (6) ;
  tests de layouts et du temps réel mis à jour (la cloche existe désormais côté agence).
- Défaut corrigé en cours de route : sans `rescue`, une alerte en erreur (rôle absent) aurait fait
  échouer la confirmation d'un paiement par webhook (détecté par `PaymentWebhookTest`).
- Résultats : backend 173 tests OK (2333 assertions), Pint OK ; frontend 86 tests OK (21 fichiers),
  lint OK, build OK.

**3b — Firebase Cloud Messaging : réalisée (05/10/2026, non commitée).** Détails : README
« Décisions et hypothèses (notifications push — phase 3b) ».

- Projet Firebase du client : `routier237-c8990`. Compte de service déposé par le client puis renommé
  en `backend/routier-api/storage/app/private/firebase-credentials.json` (ignoré par Git, vérifié :
  type service_account, bon projet ; jamais affiché). Config web publique + clé VAPID dans le `.env`
  local du frontend (`VITE_FIREBASE_*`) ; `FCM_ENABLED=true` dans le `.env` local du backend.
- Dépendances : `google/auth` ^1.55 (composer) ; `firebase` ^12.19 (npm, chargé à la demande ;
  le service worker charge les scripts compat 12.19.0 depuis gstatic — garder la même version).
  `npm audit` : `@grpc/grpc-js` via Firestore (Node, non utilisé, absent du build) — non corrigé
  (le « correctif » npm rétrograderait vers Firebase 9).
- Migration : `2026_10_05_000001_create_device_tokens_table` (FK user + personal_access_token en
  cascade). Appliquée sur `routier237_v1`.
- Backend : `Models/DeviceToken.php`, `User::deviceTokens()`, `Http/Controllers/Api/V1/PushTokenController.php`
  (`POST/DELETE auth/push-tokens`), `Support/Push/{AccessTokenProvider, GoogleAccessTokenProvider,
  FcmClient}.php`, `Jobs/SendPushNotification.php` (afterResponse, purge des jetons invalides),
  `Notifications/Channels/PushChannel.php` + `toPush()` dans les 4 notifications, `config/services.php`
  (`fcm`), `AppServiceProvider` (liaison), `routier:check-production` (fichier manquant = bloquant),
  `phpunit.xml` (`FCM_ENABLED=false`), `.env.example`.
- Frontend : `public/firebase-messaging-sw.js` (affichage en arrière-plan, `tag` = id, clic → message à
  l'onglet ou nouvel onglet), `src/lib/push.ts` (support, opt-in par compte, enable/disable/sync,
  premier plan, clics), `features/notifications/use-push-notifications.ts` (branché dans
  `NotificationToasts`), `push-notifications-card.tsx` (dans `/account` et `/agency/notifications`),
  `.env.example`, `vite.config.ts` (tests sans Firebase).
- Vérification réelle : jeton d'accès Google obtenu avec le compte de service ; l'API FCM accepte
  l'authentification et classe un jeton bidon en `invalid_token`. Envoi vers un vrai navigateur :
  **à tester par le client** (nécessite son accord de permission).
- Tests : `tests/Feature/Notifications/PushNotificationTest.php` (6) ; `push.test.tsx` (6), `lib/push.test.ts` (2).
- Résultats : backend 179 tests OK (2384 assertions), Pint OK ; frontend 94 tests OK (23 fichiers),
  lint OK, build OK (Firebase ≈ 57 Ko en morceaux chargés à la demande, bundle principal inchangé).

Phase 3 validée par le client et commitée : `7c4b26f` (GitLab + GitHub).

### Phase 4 — Super Admin : réalisée (05/10/2026) et commitée (`cd2a96b`)

Décisions du client : **pas de changement de rôle** par le super_admin (lecture seule des rôles et
permissions) ; **journal d'audit** oui ; réinitialisation par **l'admin + « Mot de passe oublié ? »**.
Détails : README « Décisions et hypothèses (Super Admin — phase 4) ».

- Migration : `2026_10_05_000002_create_audit_logs_table` (appliquée sur `routier237_v1`).
- Backend : `Models/AuditLog.php` (`record`, `recordUpdate`, clés sensibles refusées) branché dans
  Admin/UserController (suspension), Management/Organization et AgencyController, Admin/DirectorController,
  Agency/EmployeeController, Agency/ReservationController (annulation), Agency/PaymentController
  (remboursement), Agency/TripController (annulation) ; `PasswordResetController` (forgot, reset,
  sendForUser) + `lang/fr/passwords.php` + `lang/fr.json` (textes standard des e-mails) + lien React et
  e-mail français dans `AppServiceProvider::configurePasswordResets` ; `Admin/ActivityController`
  (trips, reservations, payments en lecture seule) + `AdminReservationResource`, `AdminPaymentResource`
  (téléphone masqué) ; `TripResource` (organisation si chargée) ; `Admin/AuditLogController` ;
  `AdminUserResource` + `UserController::show` (permissions, dernière activité, sessions, appareils).
- Frontend : `pages/admin/activity-page.tsx` (`/admin/activity`, onglets), `pages/admin/audit-page.tsx`
  (`/admin/audit`), `features/admin/audit-labels.ts`, `features/admin/user-sheet.tsx` (fiche du compte,
  envoi du lien) dans `users-page.tsx`, `pages/password-pages.tsx` (`/forgot-password?space=…`,
  `/reset-password`), liens « Mot de passe oublié ? » (`login-form.tsx`, `back-office-login.tsx` + prop
  `space`), `features/auth/schemas.ts` (`newPasswordSchema`), `api/admin.ts`, `api/auth.ts`,
  `features/admin/queries.ts`, `live-updates.ts` (signal admin → listes d'activité), menu admin.
- Tests : `tests/Feature/Admin/AdminPlatformToolsTest.php` (7) ; `password-pages.test.tsx` (4),
  `features/admin/admin-tools.test.tsx` (5).
- Vérification réelle : e-mail de réinitialisation (MAIL_MAILER=log) entièrement en français, lien
  `http://localhost:5173/reset-password?token=…&email=…` ; endpoints admin testés par HTTP (200).
- Incident résolu (05/10) : « le tableau de bord admin ne charge pas » = un autre projet
  (`ecole-la-pepiniere`) servait déjà le port 8000 ; deux `php artisan serve` sur le même port sous
  Windows → requêtes envoyées au premier. Le client a arrêté l'autre serveur. Pas de bug de code.
- Résultats : backend 186 tests OK (2495 assertions), Pint OK ; frontend 104 tests OK (25 fichiers),
  lint OK, build OK.

### Après la phase 4

Phase 4 commitée par le client : `cd2a96b`. Bilan du 29/10/2026 commité `77168b3` (GitLab + GitHub) :
backend 186 tests OK, frontend 104 tests OK ; `frontend/routier-web/.env.example` remis à
`VITE_API_URL=http://localhost:8000` (le passage à 8001 était un contournement local).

Toutes les phases du prompt sont réalisées. Reste à tester par le client : réception d'une notification
push Firebase dans un vrai navigateur.

## 4 bis. Site en ligne : phase de test du client (depuis le 29/10/2026)

Le client a mis le site en ligne : API `https://api.routier237.artischools.com` (répond, villes
présentes). Il veut tester tout le parcours avec les agences et comptes de démo. Décisions du client :
**1A** mot de passe des comptes de démo choisi au lancement (jamais `password`) ; **2A** serveur
temporairement en `APP_ENV=staging` pour autoriser le paiement simulé (à remettre en `production`
avant l'ouverture au public).

**Étape 1 — commande `routier:seed-demo` : réalisée (29/10/2026, non commitée, en attente du test).**

- `app/Console/Commands/SeedDemoData.php` : refuse si référentiels absents ou comptes `@routier237.test`
  existants, ignore si la démo existe, confirmation, mot de passe saisi deux fois (12 caractères,
  lettres + chiffres, pas `password`), `DemoSeeder` dans une transaction, liste des comptes à la fin.
- `DemoSeeder` : propriété `$password` (défaut `password`), constante `EMAIL_DOMAIN`.
- `DatabaseSeeder` : démo automatique seulement en `local`/`testing` (avant : tout sauf `production`)
  → en staging, `db:seed --force` ne crée plus de comptes avec `password`. Vérifié par mutation.
- Tests : `tests/Feature/Database/SeedDemoCommandTest.php` (7). La démo compte **8 comptes**.
- README : « Comptes de démonstration » et « Mise en production » mis à jour.

Commité `a1a79b3` (GitLab + GitHub).

**Hébergement constaté (29/10/2026, visite du hPanel en lecture seule)** : Hostinger **Business Web
Hosting** (mutualisé, LiteSpeed, PHP 8.3), compte SSH `u133979320` (SSH actif, port 65002).
- Frontend : `npm run build` en local, contenu de `dist/` envoyé dans
  `domains/routier237.artischools.com/public_html/` (+ `.htaccess` pour les routes React). Le `.env`
  local du frontend ne contient que `VITE_API_URL` → build en ligne **sans Reverb ni Firebase**.
- API : sous-domaine `api.` → `public_html/api/` (seulement `index.php` + `.htaccess`) ; `index.php`
  charge Laravel depuis `/home/u133979320/routier237-api/backend/routier-api` (hors du web, structure du
  dépôt : probablement un `git clone` en SSH, non vérifié). `.env`, `.git` : 403 en HTTP.
- hPanel : aucun déploiement Git configuré ; **aucune tâche Cron Routier+237** (`schedule:run` absent).
- Mutualisé → Reverb impossible : `BROADCAST_CONNECTION=null` côté API (repli par interrogation).
- `public_html/api/` n'a pas de lien `storage` → photos de profil probablement inaccessibles (à vérifier).
- Frontend local (29/10) : `.env` → `VITE_API_URL=http://localhost:8000` (`npm run dev`, sinon CORS refusé
  par l'API en ligne) ; `.env.production` → `https://api.routier237.artischools.com` (lu par `npm run build`).
  Les deux ignorés par Git.
- Composer en SSH : `proc_open` désactivé → `composer install --no-dev --optimize-autoloader --no-scripts`
  puis `php artisan package:discover --ansi`.

**29/10/2026 : démo installée en ligne par le client** (`git pull` → `a1a79b3`, `.env` serveur en
`APP_ENV=staging`, `BROADCAST_CONNECTION=null`, `routier:seed-demo` réussi). Vérifié par HTTP : les
2 agences de démo sont publiques ; recherche Bertoua → Yaoundé du lendemain = trajets 06:00 (7000) et
07:30 (5000). Tâche Cron `schedule:run` : demandée au client, non vérifiée. Prochaine étape : test du
parcours complet par le client.

**Étape 2 — toasts : réalisée et validée par le client (30/10/2026).** Retour du client :
doublon au paiement (toast du suivi « Paiement confirmé… » + toast de la notification « Réservation
confirmée », idem en cas d'échec) ; toasts à mieux styliser avec barre de temps et sortie animée.
- `notification-meta.ts` : `markAnnounced(type, réservation)` / `wasAnnounced` (10 min, par onglet) ;
  `payment-tracker.tsx` les annonce ; `notification-toasts.tsx` saute le toast et marque la notification
  lue (elle reste dans le centre). Les autres toasts d'action ne recoupent aucune notification du même
  compte (vérifié : l'annulation par le client ne notifie pas le client).
- Style : 1re version sur sonner refusée par le client (« je ne vois pas la barre »). Modèle imposé : le
  toast de son projet La Pépinière (`ecole-la-pepiniere/src/admin/toast`). **Sonner retiré** (npm
  uninstall, `components/ui/sonner.tsx` supprimé) ; toaster maison : `src/lib/toast.ts` (store, même API
  `toast()` / `.success` / `.error` / `.info` / `.warning` / `.dismiss`, option `id` = jamais de doublon,
  durées 4/6/7/8 s selon le type, 4 visibles max) et `src/components/common/toaster.tsx` (en haut à droite,
  en bas sur téléphone ; carte blanche, icône dans une pastille colorée, croix, bouton d'action, barre de
  3 px qui se vide, pause au survol et onglet masqué, entrée et sortie animées) ; keyframes `toast-in`,
  `toast-out`, `toast-countdown` dans `index.css`. Imports `sonner` → `@/lib/toast` dans 21 fichiers.
- Tests : `notifications.test.tsx` (+2, vérifié par mutation), `components/common/toaster.test.tsx` (3).
  Frontend 109 tests OK (26 fichiers), lint OK, build OK. Rendu contrôlé dans Chrome par styles calculés
  (fenêtre réduite : pas de capture) ; rendu visuel à valider par le client.

À faire ensuite (à décider) : commande de suppression des données de démo avant l'ouverture ;
mise en production définitive (`APP_ENV=production`, Resend, Reverb sur VPS), puis vrais paiements
quand les identifiants arriveront.

## 5. Fichiers clés de la refonte

- `src/index.css` : jetons de couleur, ombres (`shadow-card`, `shadow-card-hover`, `shadow-sidebar`),
  accents par espace via `:root[data-space="customer|admin"]` (posé par le layout).
- `src/components/layout/back-office-layout.tsx` : layout commun des 3 espaces
  (props `space`, `navItems`, `user{name,email,roleLabel,avatarUrl}`, `menuItems`, `notifications`, `profilePath`).
- `customer-layout.tsx`, `agency-layout.tsx`, `admin-layout.tsx`, `public-layout.tsx` (navbar + pied de page).
- `src/components/common/stat-card.tsx` (prop `tone`), `user-avatar.tsx` (initiales si pas de photo).
- `src/pages/home-page.tsx`, `src/pages/profile-page.tsx`, `src/features/profile/queries.ts`, `src/api/profile.ts`.
- Backend photo : `AvatarController.php`, `Requests/Auth/UpdateAvatarRequest.php`, migration
  `2026_09_25_000001_add_avatar_path_to_users_table.php`, `UserResource` (`avatar_url`), `lang/fr/validation.php`.
- Images : `src/assets/landing/*.webp` (utilisées). Les PNG originaux de `src/assets/` (≈ 19 Mo, dont
  3 nouveaux non utilisés : `agency-image.png`, `destination-image.png`, `20 janv. 2026, 01_42_42.png`)
  ne sont pas dans le build et sont ignorés par Git (`.gitignore`) : ils restent seulement en local.

## 6. Démarrage et vérification

```bash
# Backend
cd backend/routier-api
composer install && cp .env.example .env && php artisan key:generate
php artisan migrate --seed
php artisan storage:link      # obligatoire pour les photos de profil
php artisan serve             # http://localhost:8000
php artisan reverb:start      # temps réel ws://localhost:8080 (2e terminal, facultatif)
php artisan test              # base routier237_v1_testing

# Frontend
cd frontend/routier-web
npm install && cp .env.example .env   # VITE_API_URL=http://localhost:8000
npm run dev                   # http://localhost:5173
npm run lint && npm test && npm run build
```

Comptes de démo (mot de passe `password`) : `admin@routier237.test` (/admin/login),
`directeur@…`, `manager.bertoua@…`, `guichet.bertoua@…`, `comptable.bertoua@…`, `chauffeur.bertoua@…`,
`manager.yaounde@…` (/agency/login), `client@routier237.test` (/login). Domaine : `@routier237.test`.

Derniers résultats exécutés (05/10/2026, fin de la Phase 4) : backend **186 tests OK**, Pint OK ;
frontend **104 tests OK**, lint OK, build OK.

Attention en local : un seul `php artisan serve` sur le port 8000 (un autre projet sur ce port
intercepte les requêtes : 404 partout). Sinon `php artisan serve --port=8001` + `VITE_API_URL`.

## 7. Limites connues (ne pas inventer)

- Notifications : clients et personnel d'agence (phase 3) ; aucune alerte destinée au super_admin.
- Journal d'audit et vues d'activité : super_admin uniquement (phase 4) ; pas d'« Historique » pour le
  personnel. Le super_admin ne change pas les rôles (décision client).
- Pas de modification du nom, e-mail, téléphone (lecture seule) ; pas de page « toutes les agences »,
  de mentions légales ni de coordonnées de la plateforme.
- Pas de thème sombre (clair uniquement).
- Premier super_admin en production : à créer en console (`php artisan tinker`).

## 8. Prochain chantier (validé le 30/10/2026) : déploiement par GitHub Actions

Méthode choisie par le client : workflow GitHub Actions sur le modèle de La Pépinière
(`ecole-la-pepiniere/.github/workflows/deploy.yml` + `deploy/*.sh`) : lancement manuel, essai à blanc par
défaut, vendor et build faits sur GitHub, versions `releases/<id>` + `current`, `.env` et `storage` dans
`shared/`, sauvegardes vérifiées avant bascule, migrations sur option, vérifications HTTP, `rollback.sh`.
Spécificités Routier : deux racines (front `public_html/`, API `public_html/api/`), migration depuis
`~/routier237-api` (git clone), fichier Firebase, lien `storage`, Cron `schedule:run`, `APP_ENV=staging`
pendant les tests. Étapes : 1 fiche projet → 2 scripts dans le dépôt → 3 clé SSH + secrets (client) →
4 essai à blanc → 5 premier déploiement → 6 Cron, storage, retour arrière testé.
**Étape 1 — fiche projet (30/10/2026, en attente de validation)** :

| Élément | Valeur |
|---|---|
| Dépôt / branche | GitHub `Samuel2065/Routier-237` (+ GitLab `Sam2065/Routier-237`), `main` |
| Frontend | `https://routier237.artischools.com` → `~/domains/routier237.artischools.com/public_html/` |
| API | `https://api.routier237.artischools.com` → `public_html/api/` (`index.php` + `.htaccess`) |
| Backend actuel | `~/routier237-api/backend/routier-api` (git clone, `.env` dedans) |
| Backend cible | `~/domains/routier237.artischools.com/app/{releases,current,shared}` (modèle Pépinière) |
| Versions | PHP ^8.2 (site 8.3, Symfony 7 dans composer.lock) ; Node 22 ; Laravel 12 |
| Build | `npm ci && npm run build` → `dist/` (`.env.production` à recréer dans le workflow) |
| Tests | `php artisan test` (MySQL `routier237_v1_testing`) ; `npm test`, `npm run lint` |
| `.env` prod | à déplacer vers `app/shared/.env` (chmod 600) en gardant **le même APP_KEY** |
| Fichiers privés | `storage/app/private/firebase-credentials.json` → `shared/storage` |
| Cron | `schedule:run` inutilisable (`proc_open`) : appeler `reservations:expire` (chaque minute), `trips:complete-past` (00:30), `sanctum:prune-expired --hours=24` (quotidien) |
| Sauvegarde / retour | dump DB + archive `public_html` vérifiés avant bascule ; `rollback.sh` |
| Smoke tests | `/`, `/login`, `/agency/login`, `/admin/login`, `/up`, API `/api/v1/cities` |

Local : trajets de démo du 31/10 au 6/11 ajoutés à la main (`routier237_v1`) ; commande
`routier:demo-trips` reportée (non prioritaire).

**Étape 2 — scripts dans le dépôt (30/10/2026, non commitée, en attente de validation)** :
`.github/workflows/deploy.yml` (manuel, dry_run par défaut ; build : MySQL de service pour les tests,
`VITE_API_URL` en variable, paquet `web/ api/ backend/ deploy/` ; e2e Docker ; deploy SSH + vérifications
HTTP des deux domaines), `deploy/remote-deploy.sh` (deux racines : `public_html/` et `public_html/api/`,
lien `api/storage` → `shared/storage/app/public`), `rollback.sh`, `diagnose.sh`, `preflight.php`
(staging accepté, Reverb interdit, queue sync, mock interdit en production, Firebase lisible si FCM),
`mysql-defaults.php`, `ssh-setup.sh` (+ test), `public_html/.htaccess` (SPA), `public_html/api/{index.php,.htaccess}`
(refuse l'hôte principal), `env.production.example`, `tests/{Dockerfile,e2e.sh}` (PHP 8.3, deux vhosts,
cron sans proc_open), `deploy/README.md` (reprise de l'ancien `.env` + stockage, secrets, Cron), `.gitattributes`.
Vérifié en local : syntaxe bash/PHP, `ssh-setup-test.sh` OK, preflight démarre Laravel. **Non vérifié en
local (pas de Docker ni ShellCheck) : e2e et ShellCheck → premier essai à blanc sur GitHub.**
Trouvé : `QUEUE_CONNECTION=database` dans `.env.example` sans worker possible → `sync` en ligne (rien n'est
mis en file : push en afterResponse) ; `FIREBASE_CREDENTIALS=` vide casserait le chemin par défaut.

**31/10/2026 — essai à blanc vert, site en ligne inchangé.** Corrigé avant : `config/broadcasting.php`
(`env()` lit `null` comme null PHP → `env('BROADCAST_CONNECTION') ?? 'null'`, sinon preflight en échec et
« Broadcast connection [] » à l'exécution), commit `50ce1cb`. Contrôle en ligne (session client) : API,
recherche, trajet, agence, réservations, profil OK. Mais `index.html` en ligne date du 06/10 et contient
encore sonner, sans `toast-countdown` : le workflow a tourné avec `dry_run=true` (défaut), rien n'a été
copié. Toasts vérifiés en local sans Reverb (comme en ligne) : création, paiement simulé, passage à
« Payé » par interrogation, notification « confirmée » non doublée → aucun réglage de code nécessaire.
**Prochaine étape : relancer le workflow avec `dry_run` décoché et `allow_initial` coché (premier vrai
déploiement ; `run_migrations` si migrations en attente), puis vérifier la date de `index.html`.**

**31/10/2026 — premier vrai déploiement réussi.** `app/shared/.env` repris de `~/routier237-api` (chmod 600,
`QUEUE_CONNECTION` passé de `database` à `sync`, doublon `BROADCAST_CONNECTION` retiré, `APP_ENV=staging`
gardé : paiement simulé). Workflow lancé avec `dry_run` décoché, `allow_initial` coché, sans migrations.
Vérifié par le client : nouveaux toasts en ligne, photo de profil mise à jour (lien `api/storage` OK).
Reste (étape 6) : Cron (`reservations:expire`, `trips:complete-past`, `sanctum:prune-expired`) et test
de `rollback.sh` ; ancienne installation `~/routier237-api` à garder tant que le retour arrière n'est pas testé.

**31/10/2026 — Cron en place (étape 6, partie 1).** 3 tâches hPanel (`reservations:expire` chaque minute,
`trips:complete-past` 00:30, `sanctum:prune-expired` 03:00) avec `/usr/bin/php` (8.4) et enveloppe
`/bin/bash -c '…'` : hPanel ajoute sa redirection après la commande et écrasait `>> cron.log`. Vérifié :
`shared/storage/logs/cron.log` reçoit une ligne par minute. Commandes exactes : `deploy/README.md`.
Reste : test de `rollback.sh`. Vu au passage (autres projets du compte, non touchés) : tâches `saas`
(script absent), `wp-cron` (chemin PHP doublé) et `pepiniere:prune-media` (sans `cd … artisan`) en échec.

**31/10/2026 — 2e déploiement réussi ; onglets ouverts avant le déploiement cassés.** Les anciens
fichiers `assets/*.js` supprimés étaient servis en `index.html` (200, `text/html`) → « Failed to load
module script ». Corrigé : `deploy/public_html/.htaccess` renvoie 404 sous `assets/` (+ contrôle e2e),
`src/main.tsx` recharge une fois sur `vite:preloadError` (garde 60 s en sessionStorage). Lint, 109 tests,
build OK. À vérifier au prochain déploiement. Reste : test de `rollback.sh`.
