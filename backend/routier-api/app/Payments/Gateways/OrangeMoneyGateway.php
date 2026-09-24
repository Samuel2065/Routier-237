<?php

namespace App\Payments\Gateways;

/**
 * Orange Money Cameroun — à implémenter avec l'API marchande Orange
 * (config('payments.orange_money') : base_url, merchant_key, client_id, client_secret).
 */
class OrangeMoneyGateway extends UnconfiguredGateway
{
    public function name(): string
    {
        return 'orange_money';
    }

    protected function label(): string
    {
        return 'Orange Money';
    }
}
