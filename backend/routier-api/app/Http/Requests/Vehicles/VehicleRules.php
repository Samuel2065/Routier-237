<?php

namespace App\Http\Requests\Vehicles;

use App\Models\Vehicle;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Règles communes à la création et à la modification d'un véhicule.
 */
final class VehicleRules
{
    public const MAX_CAPACITY = 100;

    /**
     * @return array<string, list<mixed>>
     */
    public static function attributes(?Vehicle $ignore = null): array
    {
        return [
            'travel_class_id' => ['required', 'integer', 'exists:travel_classes,id'],
            'registration_number' => [
                'required', 'string', 'max:30',
                Rule::unique('vehicles', 'registration_number')->ignore($ignore),
            ],
            'brand' => ['required', 'string', 'max:60'],
            'model' => ['required', 'string', 'max:60'],
            'capacity' => ['required', 'integer', 'min:1', 'max:'.self::MAX_CAPACITY],
            'amenities' => ['nullable', 'array', 'max:10'],
            'amenities.*' => ['string', 'distinct', 'max:50'],
        ];
    }

    /**
     * Immatriculation en majuscules avec espaces normalisés (« es 214 ab » → « ES 214 AB »).
     */
    public static function normalize(FormRequest $request): void
    {
        if (is_string($request->input('registration_number'))) {
            $request->merge([
                'registration_number' => mb_strtoupper(preg_replace('/\s+/', ' ', trim($request->input('registration_number')))),
            ]);
        }
    }
}
