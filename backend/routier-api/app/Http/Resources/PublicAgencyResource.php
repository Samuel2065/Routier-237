<?php

namespace App\Http\Resources;

use App\Models\Agency;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Profil public d'une agence : uniquement des informations de présentation,
 * aucune donnée interne (statut, personnel, véhicules).
 *
 * @mixin Agency
 */
class PublicAgencyResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'organization' => $this->whenLoaded('organization', fn () => [
                'id' => $this->organization->id,
                'name' => $this->organization->name,
            ]),
            'city' => new CityResource($this->whenLoaded('city')),
            'email' => $this->email,
            'phone' => $this->phone,
            'address' => $this->address,
            'description' => $this->description,
        ];
    }
}
