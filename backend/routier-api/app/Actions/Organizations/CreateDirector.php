<?php

namespace App\Actions\Organizations;

use App\Enums\RoleName;
use App\Enums\UserStatus;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Création du compte d'un responsable d'organisation (rôle director) par le super_admin.
 * Le mot de passe initial est communiqué hors plateforme au directeur.
 */
class CreateDirector
{
    /**
     * @param  array{name: string, email: string, phone?: string|null, password: string}  $data
     */
    public function handle(Organization $organization, array $data): User
    {
        return DB::transaction(function () use ($organization, $data) {
            $user = new User([
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
                'password' => $data['password'],
            ]);
            $user->organization_id = $organization->id;
            $user->status = UserStatus::Active;
            $user->save();

            return $user->assignRole(RoleName::Director->value);
        });
    }
}
