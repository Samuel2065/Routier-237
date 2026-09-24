<?php

namespace App\Http\Resources;

use App\Models\TravelRoute;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Itinéraire (table routes).
 *
 * @mixin TravelRoute
 */
class RouteResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'departure_city' => new CityResource($this->whenLoaded('departureCity')),
            'destination_city' => new CityResource($this->whenLoaded('destinationCity')),
            'estimated_duration_minutes' => $this->estimated_duration_minutes,
            'distance_km' => $this->distance_km,
            'status' => $this->status,
            'trips_count' => $this->whenCounted('trips'),
        ];
    }
}
