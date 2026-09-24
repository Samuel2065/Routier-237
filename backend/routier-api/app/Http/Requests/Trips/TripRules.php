<?php

namespace App\Http\Requests\Trips;

use App\Enums\RecordStatus;
use App\Enums\VehicleStatus;
use Illuminate\Validation\Rule;

final class TripRules
{
    public const MAX_PRICE = 1_000_000;

    /**
     * @return array<string, list<mixed>>
     */
    public static function attributes(?int $agencyId): array
    {
        return [
            'route_id' => [
                'required', 'integer',
                Rule::exists('routes', 'id')->where('status', RecordStatus::Active->value),
            ],
            // Le véhicule doit appartenir à l'agence du trajet et être en service.
            'vehicle_id' => [
                'required', 'integer',
                Rule::exists('vehicles', 'id')
                    ->where('agency_id', $agencyId)
                    ->where('status', VehicleStatus::Active->value),
            ],
            'departure_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
            'departure_time' => ['required', 'date_format:H:i'],
            // Montant en FCFA.
            'price' => ['required', 'integer', 'min:1', 'max:'.self::MAX_PRICE],
        ];
    }
}
