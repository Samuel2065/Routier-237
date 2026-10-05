<?php

namespace App\Notifications\Channels;

use App\Jobs\SendPushNotification;
use App\Models\User;
use App\Support\Push\FcmClient;
use Illuminate\Notifications\Notification;

/**
 * Canal « push » des notifications Laravel (Firebase Cloud Messaging).
 *
 * La notification enregistrée en base reste la source de vérité : le message push porte le
 * même identifiant (notification_id), ce qui permet au frontend de ne jamais afficher deux
 * fois la même notification. Sans FCM activé ou sans appareil inscrit, rien n'est envoyé.
 *
 * Une notification qui utilise ce canal implémente toPush(): array{title, body, link}.
 */
class PushChannel
{
    public function send(object $notifiable, Notification $notification): void
    {
        if (! $notifiable instanceof User || ! FcmClient::enabled() || ! method_exists($notification, 'toPush')) {
            return;
        }

        if (! $notifiable->deviceTokens()->exists()) {
            return;
        }

        /** @var array{title: string, body: string, link: string} $push */
        $push = $notification->toPush($notifiable);

        SendPushNotification::dispatchAfterResponse($notifiable->id, [
            'notification_id' => (string) $notification->id,
            'title' => $push['title'],
            'body' => $push['body'],
            'link' => $push['link'],
        ]);
    }
}
