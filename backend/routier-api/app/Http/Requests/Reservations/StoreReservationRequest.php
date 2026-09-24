<?php

namespace App\Http\Requests\Reservations;

use App\Enums\PassengerType;
use App\Models\Reservation;
use App\Support\Phone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Réservation d'un trajet par un client connecté, pour un ou plusieurs passagers
 * (enfants compris, sans compte). La disponibilité est contrôlée sous verrou par
 * CreateReservation, pas ici.
 */
class StoreReservationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Reservation::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $max = config('routier.reservations.max_passengers');

        return [
            'trip_id' => ['required', 'integer', 'exists:trips,id'],
            'passengers' => ['required', 'array', 'min:1', 'max:'.$max],
            'passengers.*.full_name' => ['required', 'string', 'min:2', 'max:150'],
            'passengers.*.phone' => ['nullable', 'string', 'regex:'.Phone::REGEX],
            'passengers.*.birth_date' => ['nullable', 'date_format:Y-m-d', 'before:today', 'after:1900-01-01'],
            'passengers.*.passenger_type' => ['required', Rule::enum(PassengerType::class)],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function passengers(): array
    {
        return array_map(
            fn (array $passenger) => [
                'full_name' => trim($passenger['full_name']),
                'phone' => $passenger['phone'] ?? null,
                'birth_date' => $passenger['birth_date'] ?? null,
                'passenger_type' => $passenger['passenger_type'],
            ],
            array_values($this->validated('passengers')),
        );
    }

    protected function prepareForValidation(): void
    {
        $passengers = $this->input('passengers');

        if (is_array($passengers)) {
            $this->merge([
                'passengers' => array_map(
                    fn ($passenger) => is_array($passenger) && array_key_exists('phone', $passenger)
                        ? ['phone' => Phone::normalize($passenger['phone'])] + $passenger
                        : $passenger,
                    $passengers,
                ),
            ]);
        }
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'passengers.*.full_name' => 'nom du passager',
            'passengers.*.passenger_type' => 'type de passager',
            'passengers.*.birth_date' => 'date de naissance',
            'passengers.*.phone' => 'téléphone du passager',
        ];
    }
}
