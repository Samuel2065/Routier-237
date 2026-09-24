<?php

namespace App\Policies;

use App\Enums\PermissionName as P;
use App\Models\City;
use App\Models\User;

/**
 * Le référentiel des villes est public en lecture et géré par la plateforme.
 */
class CityPolicy
{
    public function create(User $user): bool
    {
        return $user->checkPermissionTo(P::CitiesManage->value);
    }

    public function update(User $user, City $city): bool
    {
        return $user->checkPermissionTo(P::CitiesManage->value);
    }
}
