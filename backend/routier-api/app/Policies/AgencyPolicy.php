<?php

namespace App\Policies;

use App\Enums\PermissionName as P;
use App\Models\Agency;
use App\Models\Organization;
use App\Models\User;

class AgencyPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->checkPermissionTo(P::AgenciesView->value);
    }

    public function view(User $user, Agency $agency): bool
    {
        return $user->checkPermissionTo(P::AgenciesView->value)
            && $user->canAccessAgency($agency);
    }

    /**
     * Création d'une agence dans une organisation donnée (director de cette organisation ou super_admin).
     */
    public function create(User $user, Organization $organization): bool
    {
        return $user->checkPermissionTo(P::AgenciesCreate->value)
            && $user->canAccessOrganization($organization);
    }

    public function update(User $user, Agency $agency): bool
    {
        return $user->checkPermissionTo(P::AgenciesUpdate->value)
            && $user->canAccessAgency($agency);
    }

    /**
     * Paramètres opérationnels de l'agence (/agency/settings).
     */
    public function updateSettings(User $user, Agency $agency): bool
    {
        return $user->checkPermissionTo(P::AgencySettingsUpdate->value)
            && $user->canAccessAgency($agency);
    }
}
