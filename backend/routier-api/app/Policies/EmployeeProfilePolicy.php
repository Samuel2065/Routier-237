<?php

namespace App\Policies;

use App\Enums\PermissionName as P;
use App\Models\Agency;
use App\Models\EmployeeProfile;
use App\Models\User;

class EmployeeProfilePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->checkPermissionTo(P::EmployeesView->value);
    }

    public function view(User $user, EmployeeProfile $employee): bool
    {
        return $user->checkPermissionTo(P::EmployeesView->value)
            && $user->canAccessAgency($employee->agency_id);
    }

    public function create(User $user, Agency $agency): bool
    {
        return $user->checkPermissionTo(P::EmployeesCreate->value)
            && $user->canAccessAgency($agency);
    }

    /**
     * Pas d'escalade : on ne modifie qu'un employé dont le rôle fait partie
     * des rôles que l'on peut soi-même attribuer.
     */
    public function update(User $user, EmployeeProfile $employee): bool
    {
        $targetRole = $employee->user?->primaryRole();

        return $user->checkPermissionTo(P::EmployeesUpdate->value)
            && $user->canAccessAgency($employee->agency_id)
            && $targetRole !== null
            && in_array($targetRole, $user->assignableRoles(), true);
    }
}
