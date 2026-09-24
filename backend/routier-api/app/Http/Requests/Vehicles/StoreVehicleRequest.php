<?php

namespace App\Http\Requests\Vehicles;

use App\Enums\PermissionName;
use App\Enums\VehicleStatus;
use App\Http\Requests\Concerns\TargetsAgency;
use App\Models\Vehicle;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreVehicleRequest extends FormRequest
{
    use TargetsAgency;

    public function authorize(): bool
    {
        return $this->authorizeForTargetAgency(Vehicle::class, PermissionName::VehiclesCreate->value);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'agency_id' => $this->agencyIdRules(),
            ...VehicleRules::attributes(),
            'status' => ['sometimes', 'required', Rule::enum(VehicleStatus::class)],
        ];
    }

    protected function prepareForValidation(): void
    {
        VehicleRules::normalize($this);
    }
}
