<?php

namespace App\Policies;

use App\Enums\PermissionName as P;
use App\Models\Organization;
use App\Models\User;

class OrganizationPolicy
{
    /**
     * La liste de toutes les organisations est réservée à la plateforme.
     */
    public function viewAny(User $user): bool
    {
        return $user->isSuperAdmin() && $user->checkPermissionTo(P::OrganizationsView->value);
    }

    public function view(User $user, Organization $organization): bool
    {
        return $user->checkPermissionTo(P::OrganizationsView->value)
            && $user->canAccessOrganization($organization);
    }

    public function create(User $user): bool
    {
        return $user->isSuperAdmin() && $user->checkPermissionTo(P::OrganizationsCreate->value);
    }

    public function update(User $user, Organization $organization): bool
    {
        return $user->checkPermissionTo(P::OrganizationsUpdate->value)
            && $user->canAccessOrganization($organization);
    }

    /**
     * Seul le super_admin crée le compte director d'une organisation (§6.1).
     */
    public function createDirector(User $user, Organization $organization): bool
    {
        return $user->isSuperAdmin() && $user->checkPermissionTo(P::OrganizationsUpdate->value);
    }
}
