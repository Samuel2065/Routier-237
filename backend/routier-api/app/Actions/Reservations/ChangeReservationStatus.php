<?php

namespace App\Actions\Reservations;

use App\Enums\ReservationStatus;
use App\Enums\TripStatus;
use App\Models\Reservation;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Transitions de statut d'une réservation (ReservationStatus::allowedTransitions).
 * Un refus lié à l'état courant répond 409 Conflict.
 */
class ChangeReservationStatus
{
    /**
     * Confirmation après paiement (appelée par le module paiements).
     * Une réservation en attente dont le délai est dépassé ne peut plus être confirmée.
     */
    public function confirm(Reservation $reservation): Reservation
    {
        return $this->transition($reservation, ReservationStatus::Confirmed, function (Reservation $reservation) {
            abort_if(
                $reservation->expires_at !== null && $reservation->expires_at->isPast(),
                Response::HTTP_CONFLICT,
                'Le délai de paiement de cette réservation est dépassé.',
            );

            $reservation->confirmed_at = now();
            $reservation->expires_at = null;
        });
    }

    /**
     * Annulation par le client (avant le départ) ou par l'agence (tant que le trajet n'est pas terminé).
     * Le remboursement éventuel d'une réservation payée relève du module paiements.
     */
    public function cancel(Reservation $reservation, bool $byCustomer): Reservation
    {
        return $this->transition($reservation, ReservationStatus::Cancelled, function (Reservation $reservation) use ($byCustomer) {
            $trip = $reservation->trip;

            if ($byCustomer) {
                abort_if(
                    $trip->hasDeparted(),
                    Response::HTTP_CONFLICT,
                    'Le trajet est déjà parti : la réservation ne peut plus être annulée en ligne.',
                );
            } else {
                abort_if(
                    $trip->status === TripStatus::Completed,
                    Response::HTTP_CONFLICT,
                    'Le trajet est terminé : la réservation fait partie de l\'historique.',
                );
            }

            $reservation->cancelled_at = now();
        });
    }

    /**
     * Expiration d'une réservation en attente dont le délai de paiement est dépassé.
     */
    public function expire(Reservation $reservation): Reservation
    {
        return $this->transition($reservation, ReservationStatus::Expired, function (Reservation $reservation) {
            abort_unless(
                $reservation->expires_at !== null && $reservation->expires_at->isPast(),
                Response::HTTP_CONFLICT,
                "Le délai de paiement de cette réservation n'est pas encore dépassé.",
            );
        });
    }

    /**
     * @param  callable(Reservation): void  $guard
     */
    private function transition(Reservation $reservation, ReservationStatus $target, callable $guard): Reservation
    {
        return DB::transaction(function () use ($reservation, $target, $guard) {
            $reservation = Reservation::query()->with('trip.route')->lockForUpdate()->findOrFail($reservation->getKey());

            abort_unless(
                $reservation->status->canTransitionTo($target),
                Response::HTTP_CONFLICT,
                "Transition impossible : {$reservation->status->value} → {$target->value}.",
            );

            $guard($reservation);

            $reservation->status = $target;
            $reservation->save();

            return $reservation;
        });
    }
}
