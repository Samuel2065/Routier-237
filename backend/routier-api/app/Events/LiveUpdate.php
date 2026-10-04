<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * Signal temps réel « des données ont changé » envoyé aux navigateurs abonnés à un canal.
 *
 * Il ne transporte aucune donnée métier : seulement les sujets concernés (réservations,
 * trajets, paiements…) et des identifiants. Le navigateur recharge alors les données
 * concernées par l'API, qui applique ses contrôles d'accès habituels.
 *
 * Diffusé immédiatement (ShouldBroadcastNow) : pas de file d'attente à faire tourner.
 */
class LiveUpdate implements ShouldBroadcastNow
{
    /**
     * @param  list<string>  $topics
     * @param  array<string, list<int>>  $ids
     */
    public function __construct(
        public readonly Channel $channel,
        public readonly array $topics,
        public readonly array $ids = [],
    ) {}

    /**
     * @return list<Channel>
     */
    public function broadcastOn(): array
    {
        return [$this->channel];
    }

    public function broadcastAs(): string
    {
        return 'live.update';
    }

    /**
     * @return array{topics: list<string>, ids: array<string, list<int>>}
     */
    public function broadcastWith(): array
    {
        return ['topics' => $this->topics, 'ids' => $this->ids];
    }
}
