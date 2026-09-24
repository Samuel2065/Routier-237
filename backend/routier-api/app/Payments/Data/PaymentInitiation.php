<?php

namespace App\Payments\Data;

use App\Enums\PaymentStatus;

/**
 * Réponse du fournisseur à une demande de paiement.
 */
final readonly class PaymentInitiation
{
    public function __construct(
        public string $reference,
        public PaymentStatus $status = PaymentStatus::Processing,
        public ?string $message = null,
        public ?string $redirectUrl = null,
    ) {}
}
