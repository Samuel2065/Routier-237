<?php

namespace App\Support\Push;

use Illuminate\Support\Facades\Http;

/**
 * Envoi d'un message à un appareil par l'API HTTP v1 de Firebase Cloud Messaging.
 *
 * Messages « data » uniquement : le service worker du frontend affiche lui-même la
 * notification système (titre, texte, lien), ce qui fonctionne aussi en HTTP local et
 * garde la même présentation sur tous les navigateurs.
 */
class FcmClient
{
    public const SENT = 'sent';

    /** Jeton expiré, désinscrit ou d'un autre projet : à supprimer. */
    public const INVALID_TOKEN = 'invalid_token';

    public const FAILED = 'failed';

    public function __construct(private readonly AccessTokenProvider $accessToken) {}

    public static function enabled(): bool
    {
        return (bool) config('services.fcm.enabled');
    }

    /**
     * @param  array<string, string>  $data
     * @return self::SENT|self::INVALID_TOKEN|self::FAILED
     */
    public function send(string $token, array $data): string
    {
        $response = Http::withToken($this->accessToken->token())
            ->acceptJson()
            ->connectTimeout(3)
            ->timeout(5)
            ->post("https://fcm.googleapis.com/v1/projects/{$this->accessToken->projectId()}/messages:send", [
                'message' => [
                    'token' => $token,
                    'data' => $data,
                    // Priorité haute et validité de 24 h (téléphone en veille, navigateur fermé).
                    'webpush' => ['headers' => ['Urgency' => 'high', 'TTL' => '86400']],
                ],
            ]);

        if ($response->successful()) {
            return self::SENT;
        }

        $code = collect((array) $response->json('error.details'))->pluck('errorCode')->filter()->first()
            ?? $response->json('error.status');
        $message = (string) $response->json('error.message');

        $invalid = $response->status() === 404
            || in_array($code, ['UNREGISTERED', 'SENDER_ID_MISMATCH'], true)
            || ($code === 'INVALID_ARGUMENT' && str_contains(strtolower($message), 'registration token'));

        return $invalid ? self::INVALID_TOKEN : self::FAILED;
    }
}
