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

        // Vérification du mot de passe même pour un e-mail inconnu : temps de réponse
        // comparable, pour ne pas révéler l'existence d'un compte.
        $passwordValid = Hash::check($password, $user?->password ?? self::dummyHash());

        if ($user === null || ! $passwordValid || ! $user->canEnterSpace($space)) {
            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        return $this->forUser($user, $space, $deviceName);
    }

    private static function dummyHash(): string
    {
        static $hash = null;

        return $hash ??= Hash::make('routier237-compte-inexistant');
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
