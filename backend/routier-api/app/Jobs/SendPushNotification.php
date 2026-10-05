<?php

namespace App\Jobs;

use App\Models\DeviceToken;
use App\Support\Push\FcmClient;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Envoie une notification push à tous les appareils d'un compte.
 *
 * Lancé après l'envoi de la réponse HTTP (afterResponse) : Firebase n'ajoute aucun délai
 * à l'action de l'utilisateur et aucune file d'attente n'est nécessaire. Les jetons que
 * Firebase déclare invalides sont supprimés ; toute autre erreur est journalisée, sans
 * jeton ni secret dans le journal.
 */
class SendPushNotification
{
    use Dispatchable;

    /**
     * @param  array{notification_id: string, title: string, body: string, link: string}  $data
     */
    public function __construct(
        public readonly int $userId,
        public readonly array $data,
    ) {}

    public function handle(FcmClient $client): void
    {
        $devices = DeviceToken::query()->where('user_id', $this->userId)->get();

        foreach ($devices as $device) {
            try {
                $result = $client->send($device->token, $this->data);
            } catch (Throwable $exception) {
                Log::warning('Push : envoi impossible.', ['device_id' => $device->id, 'error' => $exception->getMessage()]);

                // Problème de configuration ou de réseau : inutile d'insister sur les autres appareils.
                return;
            }

            if ($result === FcmClient::INVALID_TOKEN) {
                $device->delete();
            } elseif ($result === FcmClient::FAILED) {
                Log::warning('Push : message refusé par Firebase.', ['device_id' => $device->id]);
            }
        }
    }
}
