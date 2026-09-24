<?php

namespace Tests\Concerns;

use App\Actions\Auth\IssueAccessToken;
use App\Enums\AccessSpace;
use App\Models\User;

/**
 * Authentifie les requêtes de test avec un vrai jeton Sanctum limité à un espace,
 * pour exercer toute la chaîne (auth:sanctum, middleware space, policies).
 */
trait AuthenticatesInSpace
{
    protected function actingInSpace(User $user, AccessSpace $space): static
    {
        $this->app['auth']->forgetGuards();

        $token = app(IssueAccessToken::class)->forUser($user, $space)->plainTextToken;

        return $this->withToken($token);
    }

    protected function asAdmin(User $user): static
    {
        return $this->actingInSpace($user, AccessSpace::Admin);
    }

    protected function asAgency(User $user): static
    {
        return $this->actingInSpace($user, AccessSpace::Agency);
    }

    protected function asCustomer(User $user): static
    {
        return $this->actingInSpace($user, AccessSpace::Customer);
    }
}
