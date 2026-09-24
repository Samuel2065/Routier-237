<?php

namespace App\Http\Resources;

use App\Models\Trip;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Trajet, vue de gestion (espace agence). Capacité et places restantes sont
 * calculées (véhicule − réservations valides), jamais stockées.
 *
 * Relations attendues : agency, route.departureCity, route.destinationCity,
 * vehicle, travelClass ; attribut reserved_seats via Trip::withReservedSeats().
 *
 * @mixin Trip
 */
class TripResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'agency' => $this->whenLoaded('agency', fn () => [
                'id' => $this->agency->id,
                'name' => $this->agency->name,
            ]),
            'route' => new RouteResource($this->whenLoaded('route')),
            'vehicle' => $this->whenLoaded('vehicle', fn () => [
                'id' => $this->vehicle->id,
                'registration_number' => $this->vehicle->registration_number,
                'brand' => $this->vehicle->brand,
                'model' => $this->vehicle->model,
                'status' => $this->vehicle->status,
            ]),
            'travel_class' => new TravelClassResource($this->whenLoaded('travelClass')),
            'departure_date' => $this->departure_date->toDateString(),
            'departure_time' => substr($this->departure_time, 0, 5),
            'departs_at' => $this->departsAt()->toIso8601String(),
            'arrives_at' => $this->when($this->relationLoaded('route'), fn () => $this->arrivesAt()->toIso8601String()),
            'price' => $this->price,
            'currency' => 'XAF',
            'status' => $this->status,
            'capacity' => $this->whenLoaded('vehicle', fn () => $this->capacity()),
            'reserved_seats' => $this->reservedSeats(),
            'remaining_seats' => $this->whenLoaded('vehicle', fn () => $this->remainingSeats()),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
