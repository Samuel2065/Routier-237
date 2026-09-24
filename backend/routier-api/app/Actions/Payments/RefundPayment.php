<?php

namespace App\Actions\Payments;

use App\Actions\Reservations\ChangeReservationStatus;
use App\Enums\PaymentStatus;
use App\Enums\ReservationStatus;
use App\Enums\TripStatus;
use App\Models\Payment;
use App\Notifications\ReservationCancelled;
use App\Payments\Exceptions\PaymentProviderUnavailable;
use App\Payments\PaymentGatewayFactory;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Remboursement d'un paiement confirmé (comptable ou responsable autorisé).
 *
 * Si la réservation est encore confirmée et le trajet pas terminé, elle est annulée :
 * un voyageur remboursé n'a plus de place. Les frais d'annulation éventuels ne sont
 * pas gérés en V1 (remboursement intégral).
 */
class RefundPayment
{
    public function __construct(
        private readonly PaymentGatewayFactory $gateways,
        private readonly ChangeReservationStatus $reservationStatus,
    ) {}

    public function handle(Payment $payment): Payment
    {
        $cancelledReservation = null;

        $payment = DB::transaction(function () use ($payment, &$cancelledReservation) {
            $payment = Payment::query()->with('reservation.trip')->lockForUpdate()->findOrFail($payment->getKey());

            abort_unless(
                $payment->status === PaymentStatus::Paid,
                Response::HTTP_CONFLICT,
                'Seul un paiement confirmé peut être remboursé.',
            );

            $gateway = $this->gateways->byName((string) $payment->provider)
                ?? throw new PaymentProviderUnavailable('La passerelle de ce paiement n\'est pas disponible pour le remboursement.');

            $gateway->refund($payment);

            $payment->forceFill(['status' => PaymentStatus::Refunded])->save();

            $reservation = $payment->reservation;

            if ($reservation->status === ReservationStatus::Confirmed && $reservation->trip->status !== TripStatus::Completed) {
                $cancelledReservation = $this->reservationStatus->cancel($reservation, byCustomer: false);
            }

            return $payment;
        });

        if ($cancelledReservation !== null) {
            $cancelledReservation->user->notify(new ReservationCancelled($cancelledReservation, ReservationCancelled::BY_AGENCY));
        }

        return $payment;
    }
}
