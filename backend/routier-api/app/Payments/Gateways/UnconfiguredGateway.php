<?php

namespace App\Payments\Gateways;

use App\Models\Payment;
use App\Payments\Contracts\PaymentGateway;
use App\Payments\Data\PaymentInitiation;
use App\Payments\Data\PaymentResult;
use App\Payments\Exceptions\PaymentProviderUnavailable;
use Illuminate\Http\Request;

/**
 * Base des passerelles réelles non encore intégrées (§10.1) : tant que les contrats et
 * identifiants de production ne sont pas fournis, elles répondent « indisponible » (503)
 * au lieu d'inventer une intégration.
 *
 * Pour brancher un fournisseur : implémenter initiate(), parseWebhook() et refund()
 * dans la classe concrète à partir de la documentation officielle et de config('payments.*').
 */
abstract class UnconfiguredGateway implements PaymentGateway
{
    abstract protected function label(): string;

    public function initiate(Payment $payment, array $context = []): PaymentInitiation
    {
        throw $this->unavailable();
    }

    public function parseWebhook(Request $request): PaymentResult
    {
        throw $this->unavailable();
    }

    public function refund(Payment $payment): void
    {
        throw $this->unavailable();
    }

    private function unavailable(): PaymentProviderUnavailable
    {
        return new PaymentProviderUnavailable("Le paiement par {$this->label()} n'est pas encore disponible.");
    }
}
