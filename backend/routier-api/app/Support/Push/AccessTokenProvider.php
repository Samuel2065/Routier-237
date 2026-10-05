<?php

namespace App\Support\Push;

/**
 * Jeton d'accès OAuth 2 à l'API Firebase Cloud Messaging, et projet Firebase visé.
 */
interface AccessTokenProvider
{
    public function token(): string;

    public function projectId(): string;
}
