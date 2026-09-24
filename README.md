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
# créer la base : CREATE DATABASE routier237_v1 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
php artisan migrate
php artisan serve            # http://localhost:8000
php artisan test
```

### Frontend

```bash
cd frontend/routier-web
npm install
cp .env.example .env
npm run dev                  # http://localhost:5173
npm run lint
npm run build
```

## Variables d'environnement

Voir `backend/routier-api/.env.example` (bloc « Routier+237 ») et `frontend/routier-web/.env.example`.
Aucun secret réel ne doit être commité : les clés Resend et des fournisseurs de paiement
restent vides dans les fichiers d'exemple.

## Avancement par modules

| Module | Contenu                                              | Statut   |
|--------|------------------------------------------------------|----------|
| 0      | Audit et préparation de l'environnement              | Terminé  |
| 1      | Migrations, modèles, relations, seeders              | À faire  |
| 2      | Authentification, rôles, permissions, policies       | À faire  |
| 3–8    | API organisations, véhicules, trajets, recherche, réservations, paiements | À faire |
| 9–11   | Frontend public, espace agence, espace admin         | À faire  |
| 12     | Tests, sécurité, build final                         | À faire  |

## Décisions et hypothèses (module 0)

- **Base de données dédiée `routier237_v1`** : une base `routier237` existait déjà sur le poste
  (ancien projet, schéma incompatible avec le cahier des charges : sièges, `companies`…).
  Elle n'est pas modifiée.
- **MariaDB 10.4 en local** via le driver Laravel `mysql`, pour rester compatible avec MySQL en production.
- **Tests backend** : pour l'instant sur SQLite en mémoire (configuration Laravel par défaut).
  Les tests de concurrence (anti-surbooking, verrouillage) nécessiteront une base MySQL de test.
- **ESLint** remplace oxlint, fourni par défaut dans le modèle Vite, conformément au cahier des charges.
- **Paiements** : `PAYMENT_DEFAULT_DRIVER=mock`. Aucune intégration réelle Orange Money / MTN MoMo / carte
  tant que les identifiants de production ne sont pas fournis.
