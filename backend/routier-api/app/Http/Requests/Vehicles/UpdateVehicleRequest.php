<?php

namespace App\Http\Requests\Vehicles;

use App\Enums\VehicleStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Les règles dépendant des trajets à venir (classe, capacité) sont appliquées
 * par l'action UpdateVehicle.
 */
class UpdateVehicleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('vehicle'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = VehicleRules::attributes($this->route('vehicle'));

        return [
            // Pas de transfert entre agences en V1.
            'agency_id' => ['prohibited'],
            ...array_map(fn (array $fieldRules) => ['sometimes', ...$fieldRules], $rules),
            'status' => ['sometimes', 'required', Rule::enum(VehicleStatus::class)],
        ];
    }

    protected function prepareForValidation(): void
    {
        VehicleRules::normalize($this);
    }
}
