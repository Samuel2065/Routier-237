<?php

namespace App\Http\Requests\Routes;

use App\Models\TravelRoute;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRouteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', TravelRoute::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'departure_city_id' => ['required', 'integer', 'exists:cities,id'],
            'destination_city_id' => [
                'required', 'integer', 'exists:cities,id', 'different:departure_city_id',
                Rule::unique('routes', 'destination_city_id')->where('departure_city_id', $this->integer('departure_city_id')),
            ],
            'estimated_duration_minutes' => ['nullable', 'integer', 'min:10', 'max:2880'],
            'distance_km' => ['nullable', 'integer', 'min:1', 'max:3000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'destination_city_id.unique' => 'Cet itinéraire existe déjà.',
            'destination_city_id.different' => "La ville d'arrivée doit être différente de la ville de départ.",
        ];
    }
}
