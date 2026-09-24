<?php

namespace App\Http\Resources;

use App\Models\Trip;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Trajet vu par le public : données observables uniquement (§18.3), sans
 * information interne (immatriculation, statut, réservations détaillées).
 *
 * Relations attendues : agency.city, route.departureCity, route.destinationCity,
 * travelClass, vehicle ; attribut reserved_seats via Trip::withReservedSeats().
 *
 * @mixin Trip
 */
class PublicTripResource extends JsonResource
{
    /**
     * Ajoute le détail du véhicule (page trajet) en plus des données de résultat de recherche.
     */
    public bool $detailed = false;

    public function detailed(): static
    {
        $this->detailed = true;

        return $this;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'agency' => [
                'id' => $this->agency->id,
                'name' => $this->agency->name,
                'city' => new CityResource($this->agency->city),
            ],
            'departure_city' => new CityResource($this->route->departureCity),
            'destination_city' => new CityResource($this->route->destinationCity),
            'departure_date' => $this->departure_date->toDateString(),
            'departure_time' => substr($this->departure_time, 0, 5),
            'departs_at' => $this->departsAt()->toIso8601String(),
            'estimated_arrival_at' => $this->route->estimated_duration_minutes
                ? $this->arrivesAt()->toIso8601String()
                : null,
            'estimated_duration_minutes' => $this->route->estimated_duration_minutes,
            'distance_km' => $this->route->distance_km,
            'travel_class' => new TravelClassResource($this->travelClass),
            'price' => $this->price,
            'currency' => 'XAF',
            'remaining_seats' => $this->remainingSeats(),
            'vehicle' => $this->when($this->detailed, fn () => [
                'brand' => $this->vehicle->brand,
                'model' => $this->vehicle->model,
                'capacity' => $this->vehicle->capacity,
                'amenities' => $this->vehicle->amenities ?? [],
            ]),
            'bookable' => $this->when($this->detailed, fn () => $this->isBookable()),
        ];
    }
}
