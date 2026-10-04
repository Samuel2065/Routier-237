# Routier+237 — Point de reprise (04/10/2026)

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
| 1 | Sécurité et séparation des accès | ✅ terminé le 04/10, **non commité, en attente du test et du feu vert client** |
| 2 | Données React actualisées sans rechargement | à faire |
| 3 | Toasts, centre de notifications, Firebase Cloud Messaging | à faire |
| 4 | Fonctionnalités Super Admin | à faire |

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

### Plan des phases suivantes

- **Phase 2** : Laravel Reverb + Echo (justifié en phase 2) ou TanStack seul ; événements sans
  données sensibles, canaux privés par agence/utilisateur, invalidation ciblée des requêtes.
- **Phase 3** : notifications pour personnel/admin, toasts automatiques dédupliqués par id de
  notification, centre de notifications dans les 3 espaces, FCM (table des jetons d'appareil,
  service worker, VAPID, envoi serveur), étapes Firebase Console guidées pour le client.
- **Phase 4** : réinitialisation sécurisée du mot de passe, vues globales, rôles et journal d'audit
  (si validés), recherche/filtres.

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
  ne sont pas dans le build ; **décision client en attente** : les sortir du dépôt avant commit.

## 6. Démarrage et vérification

```bash
# Backend
cd backend/routier-api
composer install && cp .env.example .env && php artisan key:generate
php artisan migrate --seed
php artisan storage:link      # obligatoire pour les photos de profil
php artisan serve             # http://localhost:8000
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

Derniers résultats exécutés (04/10/2026, fin de Phase 1) : backend **162 tests OK**, Pint OK ;
frontend **68 tests OK**, lint OK, build OK (bundle principal ≈ 132,5 Ko gzip).

## 7. Limites connues (ne pas inventer)

- Notifications : uniquement pour les clients (pas pour le personnel ni l'admin).
- Pas de journal d'activité (« Historique ») pour le personnel/admin ; pas de modification du nom,
  e-mail, téléphone (lecture seule) ; pas de page « toutes les agences », de mentions légales ni de
  coordonnées de la plateforme.
- Pas de thème sombre (clair uniquement).
- Premier super_admin en production : à créer en console (`php artisan tinker`).
