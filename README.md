# Routier+237

Plateforme de recherche, réservation et gestion des voyages routiers (Cameroun).
La spécification de référence est le **Cahier des charges Routier+237 v1.0**.

- **Espace public** : recherche de trajets et réservation par les voyageurs.
- **Espace agence** : logiciel privé de gestion (`/agency/...`).
- **Espace administrateur** : supervision de la plateforme (`/admin/...`).

## Architecture

```
React (frontend/routier-web) → Axios / HTTP JSON → Laravel API (backend/routier-api) → MySQL
```

Le frontend n'accède jamais directement à la base de données : toutes les règles métier
et tous les contrôles d'autorisation sont faits par l'API Laravel.

| Dossier                 | Stack                                              |
|-------------------------|----------------------------------------------------|
| `backend/routier-api`   | Laravel 12, PHP 8.2+, MySQL (Sanctum et Spatie Permission : module 2) |
| `frontend/routier-web`  | React 19, TypeScript, Vite, ESLint (Tailwind, shadcn/ui, Router, Query, Zustand, RHF, Zod : module 9) |

## Prérequis

- PHP ≥ 8.2 avec `pdo_mysql`, `mbstring`, `openssl`, `intl`, `fileinfo`
- Composer 2
- Node.js ≥ 20 et npm
- MySQL 8 ou MariaDB ≥ 10.4 (XAMPP fournit MariaDB 10.4)

## Démarrage en développement

### Backend

```bash
cd backend/routier-api
composer install
cp .env.example .env
php artisan key:generate
# créer les bases (développement + tests) :
#   CREATE DATABASE routier237_v1         CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
#   CREATE DATABASE routier237_v1_testing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
php artisan migrate --seed   # ou migrate:fresh --seed pour repartir de zéro
php artisan serve            # http://localhost:8000
php artisan test             # utilise routier237_v1_testing (voir phpunit.xml)
```

### Comptes de démonstration

Créés par `DemoSeeder` (jamais en production). Mot de passe commun : **`password`**.
Toutes les données sont fictives.

| Rôle            | E-mail                               | Rattachement                     |
|-----------------|--------------------------------------|----------------------------------|
| super_admin     | admin@routier237.test                | plateforme                       |
| director        | directeur@routier237.test            | organisation « Routier Démo Voyages » |
| agency_manager  | manager.bertoua@routier237.test      | Agence Bertoua Centre (pilote)   |
| counter_clerk   | guichet.bertoua@routier237.test      | Agence Bertoua Centre            |
| accountant      | comptable.bertoua@routier237.test    | Agence Bertoua Centre            |
| driver          | chauffeur.bertoua@routier237.test    | Agence Bertoua Centre            |
| agency_manager  | manager.yaounde@routier237.test      | Agence Yaoundé Mvan              |
| customer        | client@routier237.test               | aucun                            |

La démo contient aussi 14 villes, les classes VIP et Classique, 6 véhicules, 8 itinéraires et
66 trajets datés relativement au jour du seeding (hier : terminés ; J+1 à J+7 : publiés,
dont un annulé ; J+8 à J+10 : brouillons).

### Frontend

```bash
cd frontend/routier-web
npm install
cp .env.example .env
npm run dev                  # http://localhost:5173
npm run lint
npm run build
```

## Authentification API

Jetons **Bearer Sanctum**, un point d'entrée par espace. Chaque jeton est limité à l'espace
par lequel l'utilisateur s'est connecté.

| Méthode | URL                            | Accès                                   |
|---------|--------------------------------|-----------------------------------------|
| POST    | `/api/v1/auth/register`        | public, crée un compte **client** uniquement |
| POST    | `/api/v1/auth/login`           | public, clients                         |
| POST    | `/api/v1/agency/auth/login`    | public, director et personnel d'agence  |
| POST    | `/api/v1/admin/auth/login`     | public, super_admin                     |
| GET     | `/api/v1/auth/me`              | jeton : profil, rôle, permissions, périmètre |
| POST    | `/api/v1/auth/logout`          | jeton : révoque le jeton courant        |

Réponse de connexion : `{ data: { token, token_type: "Bearer", expires_at, space, user } }`.
Les requêtes suivantes envoient `Authorization: Bearer <token>`.

Les routes privées sont regroupées sous `/api/v1/account/*` (client), `/api/v1/agency/*`
(agence) et `/api/v1/admin/*` (administrateur). Le middleware `space` y vérifie l'espace
du jeton et que le compte est toujours actif. Les policies vérifient permission et périmètre.

## Variables d'environnement

Voir `backend/routier-api/.env.example` (bloc « Routier+237 ») et `frontend/routier-web/.env.example`.
Aucun secret réel ne doit être commité : les clés Resend et des fournisseurs de paiement
restent vides dans les fichiers d'exemple.

## Avancement par modules

| Module | Contenu                                              | Statut   |
|--------|------------------------------------------------------|----------|
| 0      | Audit et préparation de l'environnement              | Terminé  |
| 1      | Migrations, modèles, relations, seeders              | Terminé  |
| 2      | Authentification, rôles, permissions, policies       | Terminé  |
| 3–8    | API organisations, véhicules, trajets, recherche, réservations, paiements | À faire |
| 9–11   | Frontend public, espace agence, espace admin         | À faire  |
| 12     | Tests, sécurité, build final                         | À faire  |

## Décisions et hypothèses (module 0)

- **Base de données dédiée `routier237_v1`** : une base `routier237` existait déjà sur le poste
  (ancien projet, schéma incompatible avec le cahier des charges : sièges, `companies`…).
  Elle n'est pas modifiée.
- **MariaDB 10.4 en local** via le driver Laravel `mysql`, pour rester compatible avec MySQL en production.
- **ESLint** remplace oxlint, fourni par défaut dans le modèle Vite, conformément au cahier des charges.
- **Paiements** : `PAYMENT_DEFAULT_DRIVER=mock`. Aucune intégration réelle Orange Money / MTN MoMo / carte
  tant que les identifiants de production ne sont pas fournis.

## Décisions et hypothèses (module 1 — modèle de données)

- **Ordre des migrations** conforme au §14 : `cities`, `organizations`, `agencies` avant `users`
  (fichiers `0001_01_01_00000x`), puis Spatie, puis les tables métier et `notifications`.
- **Périmètre des utilisateurs** : un `director` est rattaché à son organisation par
  `users.organization_id` ; le personnel d'agence par `employee_profiles.agency_id`
  (un utilisateur = une agence) ; un client ou le super_admin n'a aucun rattachement.
- **Modèle `TravelRoute`** pour la table `routes`, afin d'éviter la confusion avec la façade `Route`.
  La relation `Trip::route()` utilise la colonne `route_id`.
- **Statuts** stockés en chaînes et typés par des enums PHP (`app/Enums`), plutôt que des ENUM MySQL,
  pour pouvoir faire évoluer les valeurs sans modifier les colonnes.
- **Montants** en entiers FCFA (XAF n'a pas de subdivision) ; `payments.currency` vaut `XAF`.
- **Capacité / disponibilité** : aucune colonne de capacité, de places restantes ou de siège sur
  `trips` ou `passengers`. La capacité vient de `vehicles.capacity` (§8, critère A7).
- **`trips.travel_class_id`** est conservé comme demandé au §15.10. Sa cohérence avec la classe du
  véhicule (et celle de `vehicle.agency_id` avec `trip.agency_id`) sera imposée par l'API au module 5.
- **Suppressions** : clés étrangères en `restrict` par défaut pour préserver l'historique commercial
  (§16). Seuls `passengers` et `driver_profiles`, simples extensions, sont en `cascade`.
- **Assignation en masse** : les champs de propriété (`agency_id`, `user_id`, `organization_id`) et
  les champs calculés (montants, statuts de réservation/paiement, référence) ne sont pas `fillable`.
- **Rôles** : les 7 rôles sont créés dès le module 1 (nécessaires aux comptes de démo) ; les
  permissions par module/action et les policies arrivent au module 2.
- **Tests backend** sur une base MySQL/MariaDB dédiée `routier237_v1_testing`, jamais la base de
  développement. Cela permettra de tester le verrouillage anti-surbooking au module 7.

## Décisions et hypothèses (module 2 — authentification et autorisations)

- **Jetons Bearer plutôt que cookies de session** : le frontend et l'API sont déployés séparément
  (§23), souvent sur des domaines différents, où les cookies SPA sont fragiles. Les jetons expirent
  (`SANCTUM_TOKEN_EXPIRATION`, 7 jours par défaut) et une tâche planifiée purge les jetons expirés.
  Le frontend devra stocker le jeton côté navigateur : cela impose de soigner la protection XSS.
- **Un jeton = un espace** (ability `space:customer|agency|admin`). Un client ne peut pas appeler
  l'API agence, le super_admin ne passe pas par l'espace agence, et inversement.
- **Un rôle par utilisateur en V1** : un employé qui voyage utilise un compte client distinct.
- **Message d'échec unique** à la connexion (mauvais mot de passe, mauvais espace, compte désactivé),
  pour ne pas révéler l'existence d'un compte. 5 tentatives par minute par e-mail + IP.
- **Désactivation immédiate** : si le compte, le profil employé, l'agence ou l'organisation est
  désactivé, la requête suivante est refusée (403) et le jeton est révoqué.
- **Permissions « module.action »** (`app/Enums/PermissionName.php`) ; la matrice rôle → permissions
  est dans `RoleName::permissions()` et se resynchronise avec `php artisan db:seed --class=RoleSeeder`.
- **Autorisation = permission + périmètre** : chaque policy (`app/Policies`) vérifie la permission
  Spatie *et* que la ressource appartient à une agence accessible (`User::accessibleAgencyIds()`).
  Les listes utilisent le scope `accessibleBy($user)`. Un identifiant envoyé par le client n'est
  jamais une preuve de propriété (§17.3).
- **Pas d'escalade de privilèges** : un agency_manager ne gère que counter_clerk, accountant et driver ;
  un director tous les rôles d'agence ; seul le super_admin crée des organisations et des directors.
- **Messages de validation** : seuls les messages d'authentification sont traduits (`lang/fr/auth.php`).
  La traduction complète des messages de validation est à décider avec le frontend (module 9).
- Pas de réinitialisation de mot de passe ni de vérification d'e-mail en V1 : non exigées par le
  cahier des charges, à ajouter si besoin.
