<?php

namespace App\Http\Requests\Trips;

use App\Enums\PermissionName;
use App\Enums\TripStatus;
use App\Http\Requests\Concerns\TargetsAgency;
use App\Models\Trip;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Création d'un trajet. La classe n'est pas saisie : elle est celle du véhicule.
 * status=published publie directement (mêmes contrôles que l'action « publier »).
 */
class StoreTripRequest extends FormRequest
{
    use TargetsAgency;

    public function authorize(): bool
    {
        if ($this->input('status') === TripStatus::Published->value
            && ! $this->user()->checkPermissionTo(PermissionName::TripsPublish->value)) {
            return false;
        }

        return $this->authorizeForTargetAgency(Trip::class, PermissionName::TripsCreate->value);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'agency_id' => $this->agencyIdRules(),
            ...TripRules::attributes($this->targetAgency()?->id),
            'travel_class_id' => ['prohibited'],
            'status' => ['sometimes', Rule::in([TripStatus::Draft->value, TripStatus::Published->value])],
        ];
    }

    public function wantsPublication(): bool
    {
        return $this->validated('status') === TripStatus::Published->value;
    }
}
