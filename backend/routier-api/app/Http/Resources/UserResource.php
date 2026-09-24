<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Profil de l'utilisateur connecté, avec son rôle, ses permissions et son périmètre.
 * Le frontend s'en sert pour adapter l'interface ; l'API reste seule juge des droits.
 *
 * @mixin User
 */
class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $agency = $this->isAgencyStaff() ? $this->employeeProfile?->agency : null;
        $organization = $this->isDirector() ? $this->organization : $agency?->organization;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'status' => $this->status,
            'role' => $this->primaryRole(),
            'permissions' => $this->getAllPermissions()->pluck('name')->sort()->values(),
            // Rôles que l'utilisateur peut attribuer (formulaire du personnel) ; l'API revérifie.
            'assignable_roles' => array_map(fn ($role) => $role->value, $this->assignableRoles()),
            'organization' => $organization ? [
                'id' => $organization->id,
                'name' => $organization->name,
            ] : null,
            'agency' => $agency ? [
                'id' => $agency->id,
                'name' => $agency->name,
            ] : null,
            'created_at' => $this->created_at,
        ];
    }
}
