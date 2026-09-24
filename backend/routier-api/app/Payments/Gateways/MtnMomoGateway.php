<?php

namespace App\Payments\Gateways;

/**
 * MTN Mobile Money — à implémenter avec l'API MoMo Collection
 * (config('payments.mtn_momo') : base_url, subscription_key, api_user, api_key, environment).
 */
class MtnMomoGateway extends UnconfiguredGateway
{
    public function name(): string
    {
        return 'mtn_momo';
    }

    protected function label(): string
    {
        return 'MTN MoMo';
    }
}
