<?php

namespace App\Actions\Trips;

use App\Enums\RecordStatus;
use App\Enums\ReservationStatus;
use App\Enums\TripStatus;
use App\Enums\VehicleStatus;
use App\Models\Trip;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Machine d'état des trajets (TripStatus::allowedTransitions), contrôlée côté backend.
 * Un refus lié à l'état courant répond 409 Conflict avec un message explicite.
 */
class ChangeTripStatus
{
    public function handle(Trip $trip, TripStatus $target): Trip
    {
        return DB::transaction(function () use ($trip, $target) {
            $trip = Trip::query()
                ->with(['agency.organization', 'vehicle', 'route'])
                ->lockForUpdate()
                ->findOrFail($trip->getKey());

            $this->ensure(
                $trip->status->canTransitionTo($target),
                "Transition impossible : {$trip->status->value} → {$target->value}.",
            );

            match ($target) {
                TripStatus::Published => $this->checkPublishable($trip),
                TripStatus::Draft => $this->ensure(
                    $trip->reservedSeats() === 0,
                    'Des places sont réservées : annulez le trajet au lieu de le repasser en brouillon.',
                ),
                TripStatus::Completed => $this->ensure(
                    $trip->hasDeparted(),
                    "Un trajet ne peut être terminé qu'après son départ.",
                ),
                TripStatus::Cancelled => $this->cancelReservations($trip),
            };

            $trip->status = $target;
            $trip->save();

            return $trip;
        });
    }

    /**
     * Conditions de publication : départ futur, agence, organisation, véhicule et itinéraire actifs.
     */
    private function checkPublishable(Trip $trip): void
    {
        $this->ensure(! $trip->hasDeparted(), 'Impossible de publier un trajet dont le départ est passé.');
        $this->ensure(
            $trip->agency->status === RecordStatus::Active && $trip->agency->organization->status === RecordStatus::Active,
            "L'agence ou son organisation est inactive.",
        );
        $this->ensure($trip->vehicle->status === VehicleStatus::Active, "Le véhicule n'est pas en service.");
        $this->ensure($trip->route->status === RecordStatus::Active, "L'itinéraire est désactivé.");
    }

    /**
     * Les réservations actives d'un trajet annulé sont annulées avec lui.
     * Remboursements et notifications : modules 7 et 8.
     */
    private function cancelReservations(Trip $trip): void
    {
        $trip->reservations()
            ->whereIn('status', [ReservationStatus::Pending, ReservationStatus::Confirmed])
            ->update([
                'status' => ReservationStatus::Cancelled,
                'cancelled_at' => now(),
                'updated_at' => now(),
            ]);
    }

    private function ensure(bool $condition, string $message): void
    {
        abort_unless($condition, Response::HTTP_CONFLICT, $message);
    }
}
