<?php

namespace App\Http\Resources;

use App\Models\Agency;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Agence, vue de gestion (espaces agence et administrateur).
 *
 * @mixin Agency
 */
class AgencyResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'organization_id' => $this->organization_id,
            'organization' => $this->whenLoaded('organization', fn () => [
                'id' => $this->organization->id,
                'name' => $this->organization->name,
                'status' => $this->organization->status,
            ]),
            'city' => new CityResource($this->whenLoaded('city')),
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'address' => $this->address,
            'description' => $this->description,
            'status' => $this->status,
            'employees_count' => $this->whenCounted('employeeProfiles'),
            'vehicles_count' => $this->whenCounted('vehicles'),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
