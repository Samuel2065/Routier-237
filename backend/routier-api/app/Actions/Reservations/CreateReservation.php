<?php

namespace App\Actions\Reservations;

use App\Enums\ReservationStatus;
use App\Models\Reservation;
use App\Models\Trip;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Création d'une réservation avec contrôle anti-surbooking (cahier des charges §8).
 *
 * La ligne du trajet est verrouillée (SELECT … FOR UPDATE) pendant toute la transaction :
 * deux réservations concurrentes sur le même trajet sont sérialisées, et chacune recalcule
 * les places restantes après la précédente. Aucune donnée de siège n'est utilisée.
 *
 * La réservation est créée « en attente » et bloque ses places jusqu'à expires_at ;
 * le paiement (module 8) la confirme.
 */
class CreateReservation
{
    /**
     * @param  list<array{full_name: string, phone?: string|null, birth_date?: string|null, passenger_type: string}>  $passengers
     */
    public function handle(User $customer, int $tripId, array $passengers): Reservation
    {
        // Nouvelles tentatives automatiques en cas d'interblocage détecté par MySQL.
        return DB::transaction(function () use ($customer, $tripId, $passengers) {
            $trip = Trip::query()->lockForUpdate()->findOrFail($tripId);
            $trip->load(['agency.organization', 'vehicle', 'route']);

            $count = count($passengers);
            $remaining = $trip->remainingSeats();

            abort_unless(
                $trip->isBookable(1),
                Response::HTTP_CONFLICT,
                "Ce trajet n'est plus disponible à la réservation.",
            );

            abort_if(
                $remaining < $count,
                Response::HTTP_CONFLICT,
                "Places insuffisantes : il reste {$remaining} place(s) sur ce trajet.",
            );

            $reservation = new Reservation;
            $reservation->forceFill([
                'reference' => $this->uniqueReference(),
                'trip_id' => $trip->id,
                'user_id' => $customer->id,
                'passenger_count' => $count,
                // Valeur commerciale figée au moment de la réservation.
                'total_amount' => $trip->price * $count,
                'status' => ReservationStatus::Pending,
                'expires_at' => now()->addMinutes(config('routier.reservations.pending_ttl_minutes')),
            ])->save();

            $reservation->passengers()->createMany($passengers);

            return $reservation;
        }, attempts: 3);
    }

    /**
     * Référence lisible au guichet, sans caractères ambigus (0/O, 1/I).
     */
    private function uniqueReference(): string
    {
        do {
            $reference = 'R237-'.collect(range(1, 8))
                ->map(fn () => Str::of('ABCDEFGHJKLMNPQRSTUVWXYZ23456789')->substr(random_int(0, 31), 1))
                ->implode('');
        } while (Reservation::query()->where('reference', $reference)->exists());

        return $reference;
    }
}
