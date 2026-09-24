<?php

namespace App\Actions\Vehicles;

use App\Models\Vehicle;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Modification d'un véhicule en préservant la cohérence des trajets à venir :
 * - la classe d'un trajet est celle de son véhicule : pas de changement de classe
 *   tant que le véhicule a des trajets à venir ;
 * - la capacité ne descend pas sous les places déjà réservées sur un trajet à venir.
 */
class UpdateVehicle
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(Vehicle $vehicle, array $data): Vehicle
    {
        return DB::transaction(function () use ($vehicle, $data) {
            $vehicle = Vehicle::query()->lockForUpdate()->findOrFail($vehicle->getKey());
            $vehicle->fill($data);

            if ($vehicle->isDirty('travel_class_id') && $vehicle->trips()->upcoming()->exists()) {
                throw ValidationException::withMessages([
                    'travel_class_id' => 'Ce véhicule est affecté à des trajets à venir : sa classe ne peut pas être modifiée.',
                ]);
            }

            if ($vehicle->isDirty('capacity')) {
                // Les réservations verrouillent la ligne du trajet (module 7) : verrouiller les
                // trajets à venir empêche une réservation concurrente pendant la vérification.
                $vehicle->trips()->upcoming()->lockForUpdate()->pluck('id');

                $reserved = $vehicle->maxReservedSeatsOnUpcomingTrips();

                if ($vehicle->capacity < $reserved) {
                    throw ValidationException::withMessages([
                        'capacity' => "La capacité ne peut pas être inférieure aux {$reserved} places déjà réservées sur un trajet à venir.",
                    ]);
                }
            }

            $vehicle->save();

            return $vehicle;
        }, attempts: 3); // nouvelle tentative en cas d'interblocage (verrous trajet/véhicule)
    }
}
