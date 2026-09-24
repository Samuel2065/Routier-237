<?php

namespace App\Policies;

use App\Enums\PermissionName as P;
use App\Models\User;

/**
 * Gestion des comptes au niveau plateforme (/admin/users). La gestion du personnel
 * d'agence passe par EmployeeProfilePolicy.
 */
class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isSuperAdmin() && $user->checkPermissionTo(P::UsersView->value);
    }

    public function view(User $user, User $target): bool
    {
        return $user->is($target)
            || ($user->isSuperAdmin() && $user->checkPermissionTo(P::UsersView->value));
    }

    /**
     * Un administrateur ne peut pas modifier son propre compte par cette voie
     * (évite de se suspendre ou de se retirer ses droits par erreur).
     */
    public function update(User $user, User $target): bool
    {
        return $user->isSuperAdmin()
            && $user->checkPermissionTo(P::UsersUpdate->value)
            && ! $user->is($target);
    }
}
