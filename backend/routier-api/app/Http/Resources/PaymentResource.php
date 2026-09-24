<?php

namespace App\Http\Resources;

use App\Enums\PaymentStatus;
use App\Enums\ReservationStatus;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Payment
 */
class PaymentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reservation_id' => $this->reservation_id,
            'reservation' => $this->whenLoaded('reservation', fn () => [
                'id' => $this->reservation->id,
                'reference' => $this->reservation->reference,
                'status' => $this->reservation->status,
                'trip_id' => $this->reservation->trip_id,
            ]),
            'amount' => $this->amount,
            'currency' => $this->currency,
            'method' => $this->method,
            'provider' => $this->provider,
            'status' => $this->status,
            'transaction_reference' => $this->transaction_reference,
            'payer_phone' => $this->payer_phone,
            'paid_at' => $this->paid_at,
            'failure_reason' => $this->failure_reason,
            // Paiement encaissé dont la réservation n'est pas (ou plus) confirmée.
            'requires_refund' => $this->whenLoaded('reservation', fn () => $this->status === PaymentStatus::Paid
                && $this->reservation->status !== ReservationStatus::Confirmed),
            'created_at' => $this->created_at,
        ];
    }
}
