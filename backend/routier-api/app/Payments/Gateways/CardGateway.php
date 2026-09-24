<?php

namespace App\Payments\Gateways;

/**
 * Carte bancaire (Visa ou équivalent) — à implémenter avec le prestataire retenu
 * (config('payments.card') : provider, public_key, secret_key, webhook_secret).
 * Les données de carte ne doivent jamais transiter par l'API : page de paiement du prestataire.
 */
class CardGateway extends UnconfiguredGateway
{
    public function name(): string
    {
        return 'card';
    }

    protected function label(): string
    {
        return 'carte bancaire';
    }
}
