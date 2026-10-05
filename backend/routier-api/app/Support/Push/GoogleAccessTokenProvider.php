<?php

namespace App\Support\Push;

use Google\Auth\Credentials\ServiceAccountCredentials;
use Illuminate\Support\Facades\Cache;
use RuntimeException;

/**
 * Jeton d'accès obtenu auprès de Google avec le compte de service Firebase (google/auth).
 *
 * Le jeton (valable une heure) est gardé 50 minutes en cache pour éviter un échange avec
 * Google à chaque envoi. La clé privée du compte de service ne quitte jamais le serveur.
 */
class GoogleAccessTokenProvider implements AccessTokenProvider
{
    private const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

    private const CACHE_KEY = 'fcm.access_token';

    /** @var array<string, mixed>|null */
    private ?array $credentials = null;

    public function __construct(private readonly string $credentialsPath) {}

    public function token(): string
    {
        return Cache::remember(self::CACHE_KEY, now()->addMinutes(50), function () {
            $token = (new ServiceAccountCredentials(self::SCOPE, $this->credentials()))->fetchAuthToken()['access_token'] ?? null;

            if (! is_string($token) || $token === '') {
                throw new RuntimeException('Firebase : aucun jeton d\'accès obtenu.');
            }

            return $token;
        });
    }

    public function projectId(): string
    {
        return (string) ($this->credentials()['project_id'] ?? throw new RuntimeException('Firebase : project_id absent du compte de service.'));
    }

    /**
     * @return array<string, mixed>
     */
    private function credentials(): array
    {
        if ($this->credentials !== null) {
            return $this->credentials;
        }

        if (! is_readable($this->credentialsPath)) {
            throw new RuntimeException('Firebase : fichier du compte de service introuvable (FIREBASE_CREDENTIALS).');
        }

        $credentials = json_decode((string) file_get_contents($this->credentialsPath), true);

        if (! is_array($credentials) || ($credentials['type'] ?? null) !== 'service_account') {
            throw new RuntimeException('Firebase : fichier du compte de service invalide.');
        }

        return $this->credentials = $credentials;
    }
}
