<?php

namespace App\Http\Resources;

use App\Models\Vehicle;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Vehicle
 */
class VehicleResource extends JsonResource
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
            'travel_class' => new TravelClassResource($this->whenLoaded('travelClass')),
            'registration_number' => $this->registration_number,
            'brand' => $this->brand,
            'model' => $this->model,
            'capacity' => $this->capacity,
            'amenities' => $this->amenities ?? [],
            'status' => $this->status,
            'upcoming_trips_count' => $this->whenCounted('trips'),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
