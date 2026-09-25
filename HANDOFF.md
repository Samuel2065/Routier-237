# Routier+237 — Point de reprise (25/09/2026)

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

### Modules 0 à 12 du cahier des charges : TERMINÉS
Dernier commit : `26082fd Module 12 : tests, sécurité et validation finale`
(**non poussé** : `main` est en avance de 1 commit sur `origin/main`).

Décision validée par le client : **seul le comptable (accountant)** peut rembourser
(`payments.refund`) ; le director ne rembourse pas.

### Refonte de l'interface (après le module 12) — NON COMMITÉE

Plan : étape 1+2 identité + layouts → étape 3 accueil → correctif photo de profil → étape 4 « Personnel actif ».

| Étape | Contenu | Statut |
|---|---|---|
| 1+2 | Couleur par espace (voyageur bleu, agence vert, admin ambre), sidebar sombre partagée avec compte + déconnexion en bas, barre supérieure (cloche voyageur uniquement, menu du profil), cartes KPI, accueil personnalisé des tableaux de bord, espace voyageur `/account` avec sidebar | ✅ validé par le client |
| Photo de profil | Backend `users.avatar_path`, `POST/DELETE /api/v1/auth/me/avatar` ; pages « Mon profil » `/account/profile`, `/agency/profile`, `/admin/profile` | ✅ validé |
| 3 | Nouvelle page d'accueil (hero, recherche, 4 étapes, destinations, agences, avantages, classes, espace agences, FAQ, CTA, pied de page) | ✅ validé |
| 4 | « Personnel actif » sur le tableau de bord super-admin | ✅ terminé, en attente de validation |

## 4. Étape 4 — « Personnel actif » (terminée, à valider par le client)

**Fait (backend)** : `app/Http/Controllers/Api/V1/Admin/DashboardController.php` renvoie un bloc
`active_staff` dans `GET /api/v1/admin/dashboard` :

```json
"active_staff": {
  "window_minutes": 15,
  "count": 3,
  "users": [{ "id": 5, "name": "…", "role": "counter_clerk", "avatar_url": null,
              "agency": "Agence Bertoua Centre", "organization": "Routier Démo Voyages",
              "last_active_at": "2026-09-25T14:02:00+01:00" }]
}
```

Principe : personnel interne (`RoleName::internal()`), compte actif, dont un jeton Sanctum non expiré
a `last_used_at` dans les 15 dernières minutes (Sanctum met à jour ce champ à chaque requête).
10 comptes au plus, les plus récents d'abord. Réservé au super_admin (contrôle existant de l'endpoint).
Les 4 tests existants de `AdminSupervisionTest` passent avec ce bloc.

**Fait aussi** (les points ci-dessous sont réalisés : test backend, carte frontend avec état vide, tests Vitest, README) :
1. Test backend dans `tests/Feature/Admin/AdminSupervisionTest.php` : un employé avec jeton utilisé
   récemment apparaît ; jeton ancien (> 15 min), jeton expiré, compte suspendu et client n'apparaissent
   pas ; `count` correct. (Mettre `last_used_at` à la main sur `PersonalAccessToken`.)
2. Frontend : ajouter `active_staff` au type du tableau de bord admin (`src/types/api.ts`, interface
   utilisée par `useAdminDashboard` dans `src/features/admin/queries.ts`).
3. Frontend : section « Personnel actif » dans `src/pages/admin/dashboard-page.tsx` : avatar
   (`UserAvatar`), nom, rôle (`ROLE_LABELS`), agence/organisation, « actif il y a X min » ;
   état vide « Aucun membre du personnel actif dans les 15 dernières minutes. » ; indiquer le total.
4. Test Vitest de cette section, puis `npm run lint`, `npm test`, `npm run build`, `php artisan test`, Pint.
5. README : ajouter une ligne dans « Décisions et hypothèses (refonte de l'interface) ».
6. **S'arrêter** et demander la validation du client.

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

Derniers résultats exécutés : backend **154 tests OK**, Pint OK ; frontend **52 tests OK**, lint OK,
build OK (bundle principal ≈ 132 Ko gzip).

## 7. Limites connues (ne pas inventer)

- Notifications : uniquement pour les clients (pas pour le personnel ni l'admin).
- Pas de journal d'activité (« Historique ») pour le personnel/admin ; pas de modification du nom,
  e-mail, téléphone (lecture seule) ; pas de page « toutes les agences », de mentions légales ni de
  coordonnées de la plateforme.
- Pas de thème sombre (clair uniquement).
- Premier super_admin en production : à créer en console (`php artisan tinker`).
