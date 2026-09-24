<?php

namespace App\Http\Requests\Trips;

use App\Models\Trip;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Modification d'un trajet. Le statut change uniquement via les actions dédiées
 * (publier, dépublier, annuler, terminer) ; l'agence propriétaire ne change jamais.
 */
class UpdateTripRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('trip'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var Trip $trip */
        $trip = $this->route('trip');

        return [
            'agency_id' => ['prohibited'],
            'travel_class_id' => ['prohibited'],
            'status' => ['prohibited'],
            ...array_map(
                fn (array $rules) => ['sometimes', ...$rules],
                TripRules::attributes($trip->agency_id),
            ),
        ];
    }
}
