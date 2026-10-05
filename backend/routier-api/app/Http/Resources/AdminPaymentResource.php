<?php

namespace App\Http\Resources;

use App\Enums\PaymentStatus;
use App\Enums\ReservationStatus;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Paiement, vue de supervision (super_admin) : montants, statuts et rattachement, avec le
 * numéro du payeur masqué (seuls les deux derniers chiffres restent visibles).
 *
 * @mixin Payment
 */
class AdminPaymentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $reservation = $this->reservation;
        $agency = $reservation->trip->agency;

        return [
            'id' => $this->id,
            'amount' => $this->amount,
            'currency' => $this->currency,
            'method' => $this->method,
            'provider' => $this->provider,
            'status' => $this->status,
            'transaction_reference' => $this->transaction_reference,
            'payer_phone' => self::mask($this->payer_phone),
            'paid_at' => $this->paid_at,
            'failure_reason' => $this->failure_reason,
            'requires_refund' => $this->status === PaymentStatus::Paid && $reservation->status !== ReservationStatus::Confirmed,
            'created_at' => $this->created_at,
            'reservation' => ['id' => $reservation->id, 'reference' => $reservation->reference, 'status' => $reservation->status],
            'agency' => ['id' => $agency->id, 'name' => $agency->name],
            'organization' => ['id' => $agency->organization->id, 'name' => $agency->organization->name],
        ];
    }

    public static function mask(?string $phone): ?string
    {
        if ($phone === null || $phone === '') {
            return null;
        }

        $digits = preg_replace('/\D/', '', $phone);

        return str_repeat('•', max(0, strlen($digits) - 2)).substr($digits, -2);
    }
}
