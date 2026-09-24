<?php

namespace Database\Seeders;

use App\Enums\RoleName;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Rôles de référence (cahier des charges §6), idempotent.
 * Les permissions par module/action sont ajoutées au module 2.
 */
class RoleSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (RoleName::cases() as $role) {
            Role::findOrCreate($role->value, 'web');
        }
    }
}
