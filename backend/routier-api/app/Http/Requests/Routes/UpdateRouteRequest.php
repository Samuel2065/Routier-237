<?php

namespace App\Http\Requests\Routes;

use App\Enums\RecordStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Les villes d'un itinéraire ne changent pas (des trajets y sont rattachés) :
 * seules les informations indicatives et le statut sont modifiables.
 */
class UpdateRouteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('travelRoute'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'departure_city_id' => ['prohibited'],
            'destination_city_id' => ['prohibited'],
            'estimated_duration_minutes' => ['sometimes', 'nullable', 'integer', 'min:10', 'max:2880'],
            'distance_km' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:3000'],
            'status' => ['sometimes', 'required', Rule::enum(RecordStatus::class)],
        ];
    }
}
