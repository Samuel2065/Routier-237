<?php

namespace App\Http\Resources;

use App\Models\Reservation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Réservation (espaces client et agence).
 *
 * Relations attendues : trip.agency, trip.route.departureCity, trip.route.destinationCity,
 * trip.travelClass ; passengers (détail) ; user (vue agence).
 *
 * @mixin Reservation
 */
class ReservationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'status' => $this->status,
            'passenger_count' => $this->passenger_count,
            'total_amount' => $this->total_amount,
            'currency' => 'XAF',
            'expires_at' => $this->expires_at,
            'confirmed_at' => $this->confirmed_at,
            'cancelled_at' => $this->cancelled_at,
            'created_at' => $this->created_at,
            'trip' => $this->whenLoaded('trip', fn () => [
                'id' => $this->trip->id,
                'agency' => [
                    'id' => $this->trip->agency->id,
                    'name' => $this->trip->agency->name,
                    'phone' => $this->trip->agency->phone,
                ],
                'departure_city' => new CityResource($this->trip->route->departureCity),
                'destination_city' => new CityResource($this->trip->route->destinationCity),
                'departure_date' => $this->trip->departure_date->toDateString(),
                'departure_time' => substr($this->trip->departure_time, 0, 5),
                'departs_at' => $this->trip->departsAt()->toIso8601String(),
                'travel_class' => new TravelClassResource($this->trip->travelClass),
                'unit_price' => $this->trip->price,
                'status' => $this->trip->status,
            ]),
            'customer' => $this->whenLoaded('user', fn () => [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'email' => $this->user->email,
                'phone' => $this->user->phone,
            ]),
            'payments' => PaymentResource::collection($this->whenLoaded('payments')),
            'passengers' => $this->whenLoaded('passengers', fn () => $this->passengers->map(fn ($passenger) => [
                'id' => $passenger->id,
                'full_name' => $passenger->full_name,
                'phone' => $passenger->phone,
                'birth_date' => $passenger->birth_date?->toDateString(),
                'passenger_type' => $passenger->passenger_type,
            ])),
        ];
    }
}
