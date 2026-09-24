<?php

namespace App\Policies;

use App\Enums\PermissionName as P;
use App\Models\TravelRoute;
use App\Models\User;

/**
 * Les itinéraires forment un référentiel partagé par toutes les organisations :
 * les agences peuvent en créer, mais seule la plateforme modifie ou désactive
 * un itinéraire existant (sa modification toucherait les autres organisations).
 */
class TravelRoutePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->checkPermissionTo(P::RoutesView->value);
    }

    public function create(User $user): bool
    {
        return $user->checkPermissionTo(P::RoutesManage->value);
    }

    public function update(User $user, TravelRoute $route): bool
    {
        return $user->isSuperAdmin() && $user->checkPermissionTo(P::RoutesManage->value);
    }
}
