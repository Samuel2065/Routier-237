<?php

namespace App\Actions\Trips;

use App\Enums\TripStatus;
use App\Models\Agency;
use App\Models\TravelRoute;
use App\Models\Trip;
use App\Models\Vehicle;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

/**
 * Création ou modification d'un trajet, avec les règles de cohérence :
 *
 * - la classe du trajet est toujours celle du véhicule (VIP et Classique = véhicules distincts) ;
 * - le départ est dans le futur ;
 * - le véhicule n'est pas déjà engagé sur un trajet qui chevauche celui-ci ;
 * - si des places sont déjà réservées : itinéraire et classe figés, et le nouveau
 *   véhicule doit pouvoir accueillir les passagers déjà réservés.
 *
 * L'appartenance du véhicule à l'agence et son statut actif sont validés par la Form Request.
 */
class SaveTrip
{
    private const EDITABLE = ['route_id', 'vehicle_id', 'departure_date', 'departure_time', 'price'];

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(Trip $trip, array $data, ?Agency $agency = null): Trip
    {
        return DB::transaction(function () use ($trip, $data, $agency) {
            $isNew = ! $trip->exists;

            if ($isNew) {
                $trip->agency()->associate($agency);
                $trip->status = TripStatus::Draft;
            } else {
                // Verrou : les réservations concurrentes attendent la fin de la modification.
                $trip = Trip::query()->lockForUpdate()->findOrFail($trip->getKey());

                abort_unless(
                    $trip->status->isEditable(),
                    Response::HTTP_CONFLICT,
                    'Un trajet annulé ou terminé ne peut plus être modifié.',
                );
            }

            $trip->fill(Arr::only($data, self::EDITABLE));

            if (isset($data['departure_time'])) {
                $trip->departure_time = substr($data['departure_time'], 0, 5).':00';
            }

            // Verrou sur le véhicule : deux plannings concurrents ne peuvent pas l'engager en même temps.
            $vehicle = Vehicle::query()->lockForUpdate()->findOrFail($trip->vehicle_id);
            $trip->setRelation('vehicle', $vehicle);
            $trip->setRelation('route', TravelRoute::query()->findOrFail($trip->route_id));
            $trip->travel_class_id = $vehicle->travel_class_id;

            if (($isNew || $trip->isDirty(['departure_date', 'departure_time'])) && $trip->hasDeparted()) {
                throw ValidationException::withMessages([
                    'departure_time' => 'Le départ doit être dans le futur.',
                ]);
            }

            if (! $isNew) {
                $this->protectExistingReservations($trip);
            }

            $this->ensureVehicleIsFree($trip);

            $trip->save();

            return $trip;
        }, attempts: 3); // nouvelle tentative en cas d'interblocage (verrous trajet/véhicule)
    }

    private function protectExistingReservations(Trip $trip): void
    {
        $reserved = $trip->reservedSeats();

        if ($reserved === 0) {
            return;
        }

        if ($trip->isDirty('route_id')) {
            throw ValidationException::withMessages([
                'route_id' => "Des places sont déjà réservées : l'itinéraire ne peut plus être modifié.",
            ]);
        }

        if ($trip->isDirty('travel_class_id')) {
            throw ValidationException::withMessages([
                'vehicle_id' => 'Des places sont déjà réservées : le nouveau véhicule doit être de la même classe.',
            ]);
        }

        if ($trip->vehicle->capacity < $reserved) {
            throw ValidationException::withMessages([
                'vehicle_id' => "Ce véhicule ne peut pas accueillir les {$reserved} passagers déjà réservés.",
            ]);
        }
    }

    /**
     * Refuse un chevauchement avec un autre trajet actif du même véhicule
     * (intervalle départ → arrivée estimée).
     */
    private function ensureVehicleIsFree(Trip $trip): void
    {
        $start = $trip->departsAt();
        $end = $trip->arrivesAt();

        $conflict = Trip::query()
            ->with('route')
            ->where('vehicle_id', $trip->vehicle_id)
            ->whereIn('status', [TripStatus::Draft, TripStatus::Published])
            ->when($trip->exists, fn ($query) => $query->whereKeyNot($trip->getKey()))
            // Les trajets les plus longs durent moins de 48 h : fenêtre de recherche suffisante.
            ->whereBetween('departure_date', [$start->subDays(2)->toDateString(), $end->toDateString()])
            ->get()
            ->first(fn (Trip $other) => $other->departsAt()->lessThan($end) && $start->lessThan($other->arrivesAt()));

        if ($conflict !== null) {
            throw ValidationException::withMessages([
                'vehicle_id' => sprintf(
                    'Ce véhicule est déjà engagé sur un trajet du %s à %s.',
                    $conflict->departsAt()->format('d/m/Y'),
                    $conflict->departsAt()->format('H:i'),
                ),
            ]);
        }
    }
}
