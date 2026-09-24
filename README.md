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

## Endpoints disponibles

| Espace  | Méthode et URL (préfixe `/api/v1`)                        | Qui                         |
|---------|-----------------------------------------------------------|-----------------------------|
| public  | `GET cities`                                              | tous                        |
| public  | `GET agencies?city_id=&search=`, `GET agencies/{id}`      | tous (agences actives)      |
| agence  | `GET/PATCH agency/organizations/{id}`                     | director (son organisation) |
| agence  | `GET/POST agency/agencies`, `GET/PATCH agency/agencies/{id}` | director (ses agences) ; lecture : responsable d'agence |
| agence  | `PATCH agency/agencies/{id}/settings`                     | director, agency_manager    |
| admin   | `GET/POST admin/organizations`, `GET/PATCH admin/organizations/{id}` | super_admin      |
| admin   | `POST admin/organizations/{id}/directors`                 | super_admin                 |
| admin   | `GET/POST admin/agencies`, `GET/PATCH admin/agencies/{id}` | super_admin                |
| admin   | `POST admin/cities`, `PATCH admin/cities/{id}`            | super_admin                 |
| public  | `GET travel-classes`                                      | tous                        |
| public  | `GET trips/search?departure_city_id=&destination_city_id=&date=` (+ `passengers`, `travel_class_id`, `sort=departure\|price`) | tous |
| public  | `GET trips/{id}` (détail, champ `bookable`), `GET agencies/{id}/trips` | tous          |
| client  | `GET/POST account/reservations`, `GET account/reservations/{id}`, `POST account/reservations/{id}/cancel` | client (ses réservations) |
| agence  | `GET agency/reservations` (`?trip_id=&status=&date=&search=`), `GET agency/reservations/{id}`, `POST agency/reservations/{id}/cancel` | director, agency_manager, counter_clerk ; lecture : accountant |
| client  | `POST account/reservations/{id}/payments` (`method`, `phone` pour le mobile money), `GET account/payments/{id}` | client |
| client  | `POST account/payments/{id}/simulate` (`outcome=paid\|failed`) — passerelle mock, hors production | client |
| client  | `GET account/notifications` (`?unread=1`), `POST account/notifications/{id}/read`, `POST account/notifications/read-all` | client |
| agence  | `GET agency/payments` (`?status=&method=&trip_id=&date_from=&date_to=&requires_refund=1`), `GET agency/payments/{id}` | director, agency_manager, counter_clerk, accountant |
| agence  | `POST agency/payments/{id}/refund`                         | director, accountant        |
| public  | `POST payments/webhooks/{provider}` (signature du fournisseur) | fournisseurs de paiement |
| agence  | `GET/POST agency/vehicles`, `GET/PATCH/DELETE agency/vehicles/{id}` | director, agency_manager ; lecture : driver |
| agence  | `GET/POST agency/employees`, `GET/PATCH agency/employees/{id}` (`?role=driver` pour les conducteurs) | director, agency_manager |
| agence  | `GET/POST agency/routes`                                  | director, agency_manager    |
| admin   | `GET/POST admin/routes`, `PATCH admin/routes/{id}`        | super_admin                 |
| agence  | `GET/POST agency/trips`, `GET/PATCH/DELETE agency/trips/{id}` | director, agency_manager ; lecture : tout le personnel |
| agence  | `POST agency/trips/{id}/publish` · `/unpublish` · `/cancel` · `/complete` | director, agency_manager |

Les listes sont paginées (`?page=`, `?per_page=` ≤ 100) et acceptent `?search=` sur le nom.

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
| 3      | API organisations et agences                         | Terminé  |
| 4      | API véhicules, classes, employés et conducteurs      | Terminé  |
| 5      | API itinéraires, trajets et publication              | Terminé  |
| 6      | API recherche publique                               | Terminé  |
| 7      | API réservations et passagers (anti-surbooking)      | Terminé  |
| 8      | API paiements et notifications                       | Terminé  |
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

## Décisions et hypothèses (module 3 — organisations et agences)

- **Contrôleurs partagés** entre espaces admin et agence (`Controllers/Api/V1/Management`) :
  la même logique sert le super_admin (toutes les organisations) et le director (la sienne),
  le périmètre étant appliqué par `accessibleBy()` et les policies. Pas de duplication de règles.
- **Autorisation avant validation** : les Form Requests appellent la policy dans `authorize()`,
  un utilisateur non autorisé reçoit 403 sans apprendre quoi que ce soit des règles de validation.
- **Pas de suppression** d'organisation, d'agence ou de ville : désactivation par `status`.
  Suspendre une organisation ou une agence coupe immédiatement l'accès de son personnel et
  la retire de l'espace public.
- **Création d'un director** par le super_admin avec un mot de passe initial transmis hors
  plateforme (pas encore d'e-mail d'invitation). La gestion du personnel d'agence (employés,
  conducteurs) arrive au module 4.
- **Paramètres d'agence** (`/settings`) : le responsable d'agence ne modifie que coordonnées et
  description. Nom, ville et statut relèvent du director.
- **Profil public d'agence** : informations de présentation uniquement ; une agence inactive ou
  d'une organisation suspendue répond 404. Ses trajets publiés seront ajoutés au module 6.
- **Villes** : lecture publique ; création/renommage par le super_admin (permission `cities.manage`).
- Accès refusé à une ressource d'une autre agence : **403** (le cahier des charges demande un refus
  explicite côté API).

## Décisions et hypothèses (module 4 — véhicules, classes, personnel)

- **Classes de voyage** en lecture seule (VIP, Classique, créées par seeder) : pas d'écran de gestion
  en V1, le référentiel évolue rarement.
- **Agence cible** d'une création : le personnel d'agence crée dans sa propre agence ; un director
  (plusieurs agences) doit préciser `agency_id`, dont l'accès est vérifié par la policy.
- **Cohérence véhicule / trajets** : la classe d'un véhicule ne change pas s'il a des trajets à
  venir (la classe d'un trajet est celle de son véhicule) ; sa capacité ne descend pas sous le
  nombre de places déjà réservées sur un trajet à venir. La vérification verrouille le véhicule et
  ses trajets à venir (même verrou que les réservations du module 7).
- **Places consommées** (`Reservation::consumingCapacity()`) : réservations confirmées + réservations
  en attente non expirées (§8). Ce scope servira au calcul de disponibilité du module 7.
- **Suppression d'un véhicule** uniquement s'il n'a jamais servi (sinon 409) ; un véhicule en service
  passe au statut `retired`. Pas de transfert de véhicule ni d'employé entre agences en V1.
- **Personnel** : création du compte + profil employé (+ profil conducteur) en une transaction.
  Rôle limité aux rôles attribuables par l'auteur. Matricule unique par agence, permis unique.
- **Conducteurs** = employés au rôle `driver` avec un permis valide (date future). Le cahier des
  charges ne prévoit pas de conducteur sur un trajet : aucune affectation conducteur ↔ trajet en V1.
- **Changement de rôle** : devenir `driver` exige un permis ; quitter ce rôle désactive le profil
  conducteur (conservé pour l'historique).
- **Départ ou suspension** d'un employé, ou **nouveau mot de passe** : ses jetons sont révoqués.
  Le responsable peut réinitialiser le mot de passe d'un employé (pas d'e-mail de réinitialisation en V1).

## Décisions et hypothèses (module 5 — itinéraires, trajets, publication)

- **Fuseau horaire** de l'application : `Africa/Douala` (`APP_TIMEZONE`). Dates et heures de départ,
  « aujourd'hui » et « départ passé » sont évalués à l'heure du Cameroun.
- **Itinéraires partagés** entre organisations : les agences les consultent et créent ceux qui manquent ;
  seul le super_admin modifie durée/distance ou désactive un itinéraire. Les villes d'un itinéraire
  ne changent jamais (créer un nouvel itinéraire). Un aller et un retour sont deux itinéraires.
- **Classe du trajet = classe du véhicule**, imposée par l'API (`travel_class_id` n'est jamais saisi).
- **Véhicule** : de l'agence du trajet, en service, et libre sur l'intervalle départ → arrivée estimée
  (durée de l'itinéraire, 60 min si inconnue). Vérification sous verrou du véhicule.
- **Machine d'état** (`TripStatus`) : draft → published | cancelled ; published → draft (sans réservation)
  | cancelled | completed ; cancelled et completed sont finaux. Refus de transition : **409**.
  Publication : départ futur, agence/organisation, véhicule et itinéraire actifs.
- **Trajet réservé** : itinéraire et classe figés, nouveau véhicule de capacité suffisante ; le prix
  peut changer (le montant des réservations existantes est figé). Changement de date/heure autorisé :
  la notification des passagers viendra avec les notifications (modules 7–8).
- **Annulation d'un trajet** : ses réservations en attente/confirmées sont annulées avec lui.
  Les remboursements relèvent du module 8.
- **Suppression** : uniquement un brouillon sans réservation ; sinon annulation.
- **Places restantes** calculées à la volée : capacité du véhicule − places consommées
  (`Trip::withReservedSeats()`, `remainingSeats()`).
- **Tâche planifiée** `trips:complete-past` (00:30) : trajets publiés des jours précédents → completed.
  En production, lancer le planificateur Laravel (`php artisan schedule:run` chaque minute via cron).
- Pas de création de trajets en série (programme récurrent) en V1 : un trajet par requête.

## Décisions et hypothèses (module 6 — recherche publique)

- **Critères de visibilité** (`Trip::publiclyAvailable()`) : trajet publié, départ encore à venir
  (heure comprise pour le jour même), agence et organisation actives, véhicule en service,
  itinéraire actif. Un trajet dont le véhicule passe en maintenance disparaît de la recherche
  jusqu'à réaffectation d'un véhicule.
- **Disponibilité** filtrée en SQL (`withRemainingSeatsAtLeast`) : capacité du véhicule − places
  consommées ≥ nombre de passagers demandé (1 par défaut). Les trajets complets n'apparaissent pas ;
  leur page de détail reste accessible avec `bookable: false`.
- **Neutralité** (§18.3) : aucun score ni classement ; tri par heure de départ (défaut) ou par prix,
  toutes agences confondues. Seules des données observables sont exposées.
- **Données publiques** : ni immatriculation, ni statut interne, ni détail des réservations.
- Recherche par identifiants de ville (`GET cities`), date jusqu'à 365 jours, 1 à 20 passagers,
  100 résultats au plus pour un trajet et une date.
- **Limitation** : endpoints publics limités à 120 requêtes/minute par IP.
- Pas de suggestion de dates proches ni de correspondances (trajets avec escale) en V1.

## Décisions et hypothèses (module 7 — réservations et passagers)

- **Anti-surbooking** (`CreateReservation`) : transaction + `SELECT … FOR UPDATE` sur la ligne du
  trajet ; les réservations concurrentes d'un même trajet sont sérialisées et chacune recalcule
  les places restantes. Refus **409** si le trajet n'est plus réservable ou si les places manquent.
  Nouvelle tentative automatique en cas d'interblocage MySQL. Test de concurrence réel :
  8 processus PHP simultanés sur 5 places → exactement 5 réservations (le test échoue si le verrou
  est retiré).
- **Places consommées** : réservations confirmées + réservations en attente non expirées.
  Une réservation est créée **en attente** et bloque ses places `RESERVATION_PENDING_TTL_MINUTES`
  (15 min par défaut) ; la tâche `reservations:expire` (chaque minute) aligne le statut des
  réservations dont le délai est dépassé.
- **Machine d'état** (`ReservationStatus`) : pending → confirmed | cancelled | expired ;
  confirmed → cancelled ; cancelled et expired sont finaux. Refus : **409**.
  La confirmation est déclenchée par le paiement (module 8), pas par l'agence.
- **Annulation** : par le client avant le départ ; par l'agence (réservations de ses trajets) tant
  que le trajet n'est pas terminé. Le remboursement d'une réservation payée relève du module 8.
- **Prix** : total = prix du trajet × nombre de passagers, figé à la réservation. Pas de tarif enfant
  en V1 (non défini par le cahier des charges).
- **Passagers** : nom obligatoire, type `adult`/`child`, téléphone et date de naissance facultatifs ;
  un enfant n'a pas besoin de compte. 1 à 20 passagers par réservation.
- **Non transférable** : aucun point d'entrée ne modifie le titulaire ni les passagers d'une réservation.
- **Référence** unique `R237-XXXXXXXX` (sans caractères ambigus 0/O, 1/I), lisible au guichet.
- **Limitation** : 10 créations de réservation par minute et par client.

## Décisions et hypothèses (module 8 — paiements et notifications)

- **Architecture** (`app/Payments`) : interface `PaymentGateway` (initier, lire un webhook signé,
  rembourser), une passerelle par moyen (Orange Money, MTN MoMo, carte) et une passerelle simulée.
  `PAYMENT_DEFAULT_DRIVER=mock` utilise la simulation ; `live` utilise les passerelles réelles.
- **Aucune intégration réelle inventée** (§10.1) : les passerelles réelles répondent **503**
  « pas encore disponible » tant qu'elles ne sont pas implémentées avec les contrats et identifiants
  de production (variables `ORANGE_MONEY_*`, `MTN_MOMO_*`, `CARD_PAYMENT_*`). Rien d'autre à modifier
  pour les brancher. **La simulation est refusée en production.**
- **Paiement** : uniquement pour une réservation en attente et non expirée, un seul paiement actif à la
  fois, montant = montant figé de la réservation, numéro obligatoire pour le mobile money. Si la
  passerelle refuse, aucun paiement n'est enregistré. Colonnes ajoutées : `provider`, `payer_phone`,
  `failure_reason`.
- **Résultat** (webhook signé ou simulation) : idempotent (un paiement finalisé n'est plus modifié) ;
  montant reçu contrôlé ; paiement confirmé → réservation confirmée ; échec → le client peut réessayer.
- **Paiement tardif** (réservation expirée ou annulée entre-temps) : le paiement reste « paid » et
  apparaît `requires_refund` côté agence ; aucune réservation n'est ressuscitée.
- **Remboursement** : par le comptable ou le director (`payments.refund`), intégral, via la passerelle ;
  la réservation encore confirmée est annulée. Pas de remboursement automatique à l'annulation par le
  client ni de frais d'annulation en V1 : les paiements concernés apparaissent « à rembourser ».
- **Webhook simulé** : `POST /api/v1/payments/webhooks/mock`, en-tête `X-Mock-Signature` =
  HMAC-SHA256 du corps avec `PAYMENT_MOCK_WEBHOOK_SECRET`. Sans secret configuré, tout webhook est refusé.
- **Notifications** (table `notifications`, canal base + e-mail) : réservation confirmée, réservation
  annulée par l'agence ou suite à l'annulation du trajet, paiement échoué (base uniquement).
  E-mail via `MAIL_MAILER` : `log` en local, `resend` + `RESEND_KEY` en production.
  Envoi synchrone en V1 ; à passer en file d'attente (`ShouldQueue` + `queue:work`) si le volume l'exige.
- Pas de rapprochement planifié avec les fournisseurs (vérification des paiements restés « processing »)
  en V1 : à ajouter avec les intégrations réelles.
