<?php

namespace App\Http\Requests\Trips;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Recherche publique (§5.1) : ville de départ, ville d'arrivée, date.
 */
class SearchTripsRequest extends FormRequest
{
    public const MAX_PASSENGERS = 20;

    public const MAX_DAYS_AHEAD = 365;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'departure_city_id' => ['required', 'integer', 'exists:cities,id'],
            'destination_city_id' => ['required', 'integer', 'exists:cities,id', 'different:departure_city_id'],
            'date' => [
                'required', 'date_format:Y-m-d', 'after_or_equal:today',
                'before_or_equal:'.today()->addDays(self::MAX_DAYS_AHEAD)->toDateString(),
            ],
            'passengers' => ['sometimes', 'integer', 'min:1', 'max:'.self::MAX_PASSENGERS],
            'travel_class_id' => ['sometimes', 'integer', 'exists:travel_classes,id'],
            'sort' => ['sometimes', Rule::in(['departure', 'price'])],
        ];
    }

    public function passengers(): int
    {
        return (int) ($this->validated('passengers') ?? 1);
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'destination_city_id.different' => "La ville d'arrivée doit être différente de la ville de départ.",
            'date.after_or_equal' => 'La date de voyage ne peut pas être dans le passé.',
        ];
    }
}
