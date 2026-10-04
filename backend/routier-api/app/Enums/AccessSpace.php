<?php

namespace App\Enums;

use App\Models\User;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Espaces d'accès de l'application (cahier des charges §4).
 *
 * Chaque jeton Sanctum porte l'ability de l'espace par lequel l'utilisateur s'est connecté :
 * un jeton client ne peut pas appeler l'API agence, un jeton agence ne peut pas appeler
 * l'API administrateur, etc.
 */
enum AccessSpace: string
{
    case Customer = 'customer';
    case Agency = 'agency';
    case Admin = 'admin';

    public function ability(): string
    {
        return 'space:'.$this->value;
    }

    /**
     * Espace pour lequel le jeton courant de l'utilisateur a été émis.
     * Aucun jeton n'est émis avec l'ability « * ».
     *
     * Seul un jeton enregistré (PersonalAccessToken) ouvre un espace : un TransientToken
     * (authentification par session) répond oui à toutes les abilities et est donc refusé.
     */
    public static function fromToken(User $user): ?self
    {
        $token = $user->currentAccessToken();

        if (! $token instanceof PersonalAccessToken) {
            return null;
        }

        foreach (self::cases() as $space) {
            if ($token->can($space->ability())) {
                return $space;
            }
        }

        return null;
    }

    /**
     * @return list<RoleName>
     */
    public function allowedRoles(): array
    {
        return match ($this) {
            self::Customer => [RoleName::Customer],
            self::Agency => RoleName::internal(),
            self::Admin => [RoleName::SuperAdmin],
        };
    }
}
