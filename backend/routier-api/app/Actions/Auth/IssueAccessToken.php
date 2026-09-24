<?php

namespace App\Actions\Auth;

use App\Enums\AccessSpace;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\NewAccessToken;

/**
 * Authentifie un utilisateur pour un espace donné et émet un jeton limité à cet espace.
 *
 * Le message d'échec est identique que le mot de passe soit faux, que le compte
 * appartienne à un autre espace ou qu'il soit désactivé : on ne révèle pas
 * l'existence d'un compte.
 */
class IssueAccessToken
{
    public function handle(string $email, string $password, AccessSpace $space, ?string $deviceName = null): NewAccessToken
    {
        $user = User::query()->where('email', $email)->first();

        if ($user === null || ! Hash::check($password, $user->password) || ! $user->canEnterSpace($space)) {
            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        return $this->forUser($user, $space, $deviceName);
    }

    public function forUser(User $user, AccessSpace $space, ?string $deviceName = null): NewAccessToken
    {
        $expiration = config('sanctum.expiration');

        return $user->createToken(
            $deviceName ?: $space->value,
            [$space->ability()],
            $expiration ? now()->addMinutes((int) $expiration) : null,
        );
    }
}
