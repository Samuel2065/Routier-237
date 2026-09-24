<?php

namespace Database\Seeders;

use App\Enums\PermissionName;
use App\Enums\RoleName;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Rôles (cahier des charges §6) et permissions par module/action (§21.1), idempotent.
 *
 * La matrice rôle → permissions est définie dans RoleName::permissions() ;
 * relancer ce seeder resynchronise les rôles après une modification.
 */
class RoleSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (PermissionName::cases() as $permission) {
            Permission::findOrCreate($permission->value, 'web');
        }

        foreach (RoleName::cases() as $roleName) {
            Role::findOrCreate($roleName->value, 'web')->syncPermissions(
                array_map(fn (PermissionName $p) => $p->value, $roleName->permissions()),
            );
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
