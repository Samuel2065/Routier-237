<?php

namespace App\Payments\Data;

use App\Enums\PaymentStatus;

/**
 * Résultat final d'un paiement, tel que communiqué par le fournisseur (webhook, vérification).
 */
final readonly class PaymentResult
{
    public function __construct(
        public string $provider,
        public string $reference,
        public PaymentStatus $status,
        public ?int $amount = null,
        public ?string $failureReason = null,
    ) {}
}
