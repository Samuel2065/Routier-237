<?php

namespace App\Http\Resources;

use App\Models\Reservation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Réservation, vue de supervision (super_admin) : ce qu'il faut pour administrer la
 * plateforme, sans données personnelles superflues. Le client n'apparaît que par son nom
 * (sa fiche reste consultable dans « Utilisateurs ») ; ni contact ni passagers.
 *
 * @mixin Reservation
 */
class AdminReservationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $trip = $this->trip;

        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'status' => $this->status,
            'passenger_count' => $this->passenger_count,
            'total_amount' => $this->total_amount,
            'currency' => 'XAF',
            'created_at' => $this->created_at,
            'confirmed_at' => $this->confirmed_at,
            'cancelled_at' => $this->cancelled_at,
            'customer' => ['id' => $this->user->id, 'name' => $this->user->name],
            'trip' => [
                'id' => $trip->id,
                'departure_city' => $trip->route->departureCity->name,
                'destination_city' => $trip->route->destinationCity->name,
                'departure_date' => $trip->departure_date->toDateString(),
                'departure_time' => substr($trip->departure_time, 0, 5),
                'status' => $trip->status,
            ],
            'agency' => ['id' => $trip->agency->id, 'name' => $trip->agency->name],
            'organization' => ['id' => $trip->agency->organization->id, 'name' => $trip->agency->organization->name],
        ];
    }
}
