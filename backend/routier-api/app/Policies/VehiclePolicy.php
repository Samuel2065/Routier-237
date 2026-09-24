<?php

namespace App\Policies;

use App\Enums\PermissionName as P;
use App\Models\Agency;
use App\Models\User;
use App\Models\Vehicle;

class VehiclePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->checkPermissionTo(P::VehiclesView->value);
    }

    public function view(User $user, Vehicle $vehicle): bool
    {
        return $user->checkPermissionTo(P::VehiclesView->value)
            && $user->canAccessAgency($vehicle->agency_id);
    }

    public function create(User $user, Agency $agency): bool
    {
        return $user->checkPermissionTo(P::VehiclesCreate->value)
            && $user->canAccessAgency($agency);
    }

    public function update(User $user, Vehicle $vehicle): bool
    {
        return $user->checkPermissionTo(P::VehiclesUpdate->value)
            && $user->canAccessAgency($vehicle->agency_id);
    }

    public function delete(User $user, Vehicle $vehicle): bool
    {
        return $user->checkPermissionTo(P::VehiclesDelete->value)
            && $user->canAccessAgency($vehicle->agency_id);
    }
}
