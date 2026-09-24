<?php

namespace App\Actions\Payments;

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\ReservationStatus;
use App\Models\Payment;
use App\Models\Reservation;
use App\Payments\Data\PaymentInitiation;
use App\Payments\PaymentGatewayFactory;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Lance le paiement d'une réservation en attente auprès de la passerelle du moyen choisi.
 *
 * Règles : réservation en attente et non expirée, un seul paiement actif à la fois,
 * montant = montant figé de la réservation. Si la passerelle refuse ou est indisponible,
 * la transaction est annulée : aucun paiement fantôme n'est enregistré.
 */
class InitiatePayment
{
    public function __construct(private readonly PaymentGatewayFactory $gateways) {}

    /**
     * @return array{0: Payment, 1: PaymentInitiation}
     */
    public function handle(Reservation $reservation, PaymentMethod $method, ?string $payerPhone = null): array
    {
        $gateway = $this->gateways->forMethod($method);

        return DB::transaction(function () use ($reservation, $method, $payerPhone, $gateway) {
            $reservation = Reservation::query()->lockForUpdate()->findOrFail($reservation->getKey());

            abort_unless(
                $reservation->status === ReservationStatus::Pending,
                Response::HTTP_CONFLICT,
                "Cette réservation n'est plus en attente de paiement.",
            );

            abort_if(
                $reservation->expires_at !== null && $reservation->expires_at->isPast(),
                Response::HTTP_CONFLICT,
                'Le délai de paiement de cette réservation est dépassé.',
            );

            abort_if(
                $reservation->payments()
                    ->whereIn('status', [PaymentStatus::Pending, PaymentStatus::Processing, PaymentStatus::Paid])
                    ->exists(),
                Response::HTTP_CONFLICT,
                'Un paiement est déjà en cours pour cette réservation.',
            );

            $payment = new Payment(['method' => $method]);
            $payment->forceFill([
                'reservation_id' => $reservation->id,
                'amount' => $reservation->total_amount,
                'currency' => config('payments.currency'),
                'status' => PaymentStatus::Pending,
                'provider' => $gateway->name(),
                'payer_phone' => $payerPhone,
            ])->save();

            $initiation = $gateway->initiate($payment, ['phone' => $payerPhone]);

            $payment->forceFill([
                'transaction_reference' => $initiation->reference,
                'status' => $initiation->status,
            ])->save();

            return [$payment, $initiation];
        });
    }
}
