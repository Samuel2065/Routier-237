<?php

use App\Enums\AccessSpace;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Canaux temps réel privés (Laravel Reverb)
|--------------------------------------------------------------------------
|
| Autorisation demandée par le navigateur sur POST /api/broadcasting/auth avec son jeton
| Bearer (middleware auth:sanctum + space, voir bootstrap/app.php). Comme pour l'API,
| l'espace du jeton compte : un jeton client n'écoute jamais un canal d'agence.
| Les signaux ne contiennent que des sujets et des identifiants (App\Support\LiveUpdates).
|
| Canal public « trips » : places disponibles, sans autorisation (données déjà publiques).
|
*/

// Personnel d'une agence (et director de son organisation).
Broadcast::channel('agency.{agencyId}', fn (User $user, string $agencyId) => AccessSpace::fromToken($user) === AccessSpace::Agency
    && $user->canAccessAgency((int) $agencyId));

// Director : toutes les agences de son organisation.
Broadcast::channel('organization.{organizationId}', fn (User $user, string $organizationId) => AccessSpace::fromToken($user) === AccessSpace::Agency
    && $user->isDirector()
    && $user->canAccessOrganization((int) $organizationId));

// Client : uniquement ses propres réservations, paiements et notifications.
Broadcast::channel('user.{userId}', fn (User $user, string $userId) => AccessSpace::fromToken($user) === AccessSpace::Customer
    && $user->id === (int) $userId);

// Supervision de la plateforme.
Broadcast::channel('admin', fn (User $user) => AccessSpace::fromToken($user) === AccessSpace::Admin
    && $user->isSuperAdmin());
