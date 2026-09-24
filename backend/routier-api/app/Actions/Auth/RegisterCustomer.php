<?php

namespace App\Actions\Auth;

use App\Enums\RoleName;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Inscription publique : crée exclusivement un compte client (cahier des charges §6.1).
 * Aucun champ de la requête ne permet de choisir un rôle ou un rattachement.
 */
class RegisterCustomer
{
    /**
     * @param  array{name: string, email: string, phone?: string|null, password: string}  $data
     */
    public function handle(array $data): User
    {
        return DB::transaction(function () use ($data) {
            $user = new User([
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
                'password' => $data['password'],
            ]);
            $user->status = UserStatus::Active;
            $user->save();

            $user->assignRole(RoleName::Customer->value);

            return $user;
        });
    }
}
