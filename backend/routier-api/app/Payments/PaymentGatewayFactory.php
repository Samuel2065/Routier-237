<?php

namespace App\Payments;

use App\Enums\PaymentMethod;
use App\Payments\Contracts\PaymentGateway;
use App\Payments\Exceptions\PaymentProviderUnavailable;
use App\Payments\Gateways\CardGateway;
use App\Payments\Gateways\MockGateway;
use App\Payments\Gateways\MtnMomoGateway;
use App\Payments\Gateways\OrangeMoneyGateway;

/**
 * Choisit la passerelle d'un moyen de paiement selon config('payments.driver').
 */
class PaymentGatewayFactory
{
    /**
     * @var array<string, class-string<PaymentGateway>>
     */
    private const LIVE = [
        'orange_money' => OrangeMoneyGateway::class,
        'mtn_momo' => MtnMomoGateway::class,
        'card' => CardGateway::class,
    ];

    public function forMethod(PaymentMethod $method): PaymentGateway
    {
        return $this->usesMock()
            ? $this->mock()
            : app(self::LIVE[$method->value]);
    }

    /**
     * Passerelle d'un paiement existant ou d'un webhook, d'après son nom.
     */
    public function byName(string $name): ?PaymentGateway
    {
        if ($name === MockGateway::NAME) {
            return $this->usesMock() ? $this->mock() : null;
        }

        return isset(self::LIVE[$name]) && ! $this->usesMock() ? app(self::LIVE[$name]) : null;
    }

    public function usesMock(): bool
    {
        return config('payments.driver') === 'mock';
    }

    /**
     * La simulation n'est jamais autorisée en production : un paiement fictif y
     * confirmerait des réservations sans encaissement.
     */
    private function mock(): MockGateway
    {
        if (app()->isProduction()) {
            throw new PaymentProviderUnavailable('Les paiements simulés sont désactivés en production.');
        }

        return app(MockGateway::class);
    }
}
