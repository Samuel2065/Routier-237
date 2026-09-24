<?php

namespace App\Policies;

use App\Enums\PermissionName as P;
use App\Models\Agency;
use App\Models\Trip;
use App\Models\User;

/**
 * Gestion des trajets dans l'espace agence. La consultation publique des trajets
 * publiés ne passe pas par cette policy (module 6).
 */
class TripPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->checkPermissionTo(P::TripsView->value);
    }

    public function view(User $user, Trip $trip): bool
    {
        return $this->allowed($user, P::TripsView, $trip);
    }

    public function create(User $user, Agency $agency): bool
    {
        return $user->checkPermissionTo(P::TripsCreate->value)
            && $user->canAccessAgency($agency);
    }

    public function update(User $user, Trip $trip): bool
    {
        return $this->allowed($user, P::TripsUpdate, $trip);
    }

    public function publish(User $user, Trip $trip): bool
    {
        return $this->allowed($user, P::TripsPublish, $trip);
    }

    public function cancel(User $user, Trip $trip): bool
    {
        return $this->allowed($user, P::TripsCancel, $trip);
    }

    private function allowed(User $user, P $permission, Trip $trip): bool
    {
        return $user->checkPermissionTo($permission->value)
            && $user->canAccessAgency($trip->agency_id);
    }
}
