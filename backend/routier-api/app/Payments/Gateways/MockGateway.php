<?php

namespace App\Payments\Gateways;

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Models\Payment;
use App\Payments\Contracts\PaymentGateway;
use App\Payments\Data\PaymentInitiation;
use App\Payments\Data\PaymentResult;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Passerelle simulée pour le développement et les tests (interdite en production).
 *
 * Le paiement reste « processing » jusqu'à ce que son résultat soit simulé
 * (endpoint /simulate) ou envoyé en webhook signé HMAC-SHA256 :
 *   POST /api/v1/payments/webhooks/mock
 *   X-Mock-Signature: hash_hmac('sha256', <corps brut>, PAYMENT_MOCK_WEBHOOK_SECRET)
 *   {"reference": "MOCK-…", "status": "paid"|"failed", "amount": 14000}
 */
class MockGateway implements PaymentGateway
{
    public const NAME = 'mock';

    public function name(): string
    {
        return self::NAME;
    }

    public function initiate(Payment $payment, array $context = []): PaymentInitiation
    {
        return new PaymentInitiation(
            reference: 'MOCK-'.Str::upper(Str::random(16)),
            status: PaymentStatus::Processing,
            message: $payment->method === PaymentMethod::Card
                ? 'Paiement par carte simulé : aucun débit réel.'
                : 'Paiement mobile money simulé : aucune demande n\'est envoyée au téléphone.',
        );
    }

    public function parseWebhook(Request $request): PaymentResult
    {
        $secret = (string) config('payments.mock.webhook_secret');
        $signature = (string) $request->header('X-Mock-Signature');

        if ($secret === '' || ! hash_equals(hash_hmac('sha256', $request->getContent(), $secret), $signature)) {
            throw new HttpException(401, 'Signature de webhook invalide.');
        }

        $data = $request->validate([
            'reference' => ['required', 'string', 'max:100'],
            'status' => ['required', 'in:paid,failed'],
            'amount' => ['nullable', 'integer', 'min:0'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        return new PaymentResult(
            provider: self::NAME,
            reference: $data['reference'],
            status: PaymentStatus::from($data['status']),
            amount: $data['amount'] ?? null,
            failureReason: $data['reason'] ?? null,
        );
    }

    public function refund(Payment $payment): void
    {
        // Remboursement simulé : toujours accepté.
    }
}
