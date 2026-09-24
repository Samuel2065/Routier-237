<?php

namespace App\Http\Resources;

use App\Models\EmployeeProfile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Membre du personnel d'agence (profil employé + compte + éventuel profil conducteur).
 *
 * @mixin EmployeeProfile
 */
class EmployeeResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user' => $this->whenLoaded('user', fn () => [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'email' => $this->user->email,
                'phone' => $this->user->phone,
                'status' => $this->user->status,
            ]),
            'role' => $this->whenLoaded('user', fn () => $this->user->primaryRole()),
            'agency' => $this->whenLoaded('agency', fn () => [
                'id' => $this->agency->id,
                'name' => $this->agency->name,
            ]),
            'employee_number' => $this->employee_number,
            'hired_at' => $this->hired_at?->toDateString(),
            'status' => $this->status,
            'driver_profile' => $this->whenLoaded('driverProfile', fn () => $this->driverProfile ? [
                'license_number' => $this->driverProfile->license_number,
                'license_expires_at' => $this->driverProfile->license_expires_at->toDateString(),
                'license_expired' => $this->driverProfile->license_expires_at->isPast(),
                'status' => $this->driverProfile->status,
            ] : null),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
