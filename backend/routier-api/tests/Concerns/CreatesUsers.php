<?php

namespace Tests\Concerns;

use App\Enums\RoleName;
use App\Models\Agency;
use App\Models\EmployeeProfile;
use App\Models\Organization;
use App\Models\User;
use Database\Seeders\RoleSeeder;

/**
 * Création d'utilisateurs par rôle, correctement rattachés à leur périmètre.
 */
trait CreatesUsers
{
    protected function seedRoles(): void
    {
        $this->seed(RoleSeeder::class);
    }

    protected function superAdmin(): User
    {
        return User::factory()->create()->assignRole(RoleName::SuperAdmin->value);
    }

    protected function customer(): User
    {
        return User::factory()->create()->assignRole(RoleName::Customer->value);
    }

    protected function director(Organization $organization): User
    {
        $user = User::factory()->create();
        $user->organization_id = $organization->id;
        $user->save();

        return $user->assignRole(RoleName::Director->value);
    }

    /**
     * Membre du personnel d'agence (agency_manager, counter_clerk, accountant, driver).
     */
    protected function staff(RoleName $role, Agency $agency): User
    {
        $user = User::factory()->create()->assignRole($role->value);

        EmployeeProfile::factory()->for($user)->for($agency)->create();

        return $user;
    }
}
