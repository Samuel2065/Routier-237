<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Compte utilisateur vu par la plateforme (/admin/users) : rôle et rattachement,
 * sans permissions détaillées.
 *
 * @mixin User
 */
class AdminUserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $agency = $this->employeeProfile?->agency;
        $organization = $this->organization ?? $agency?->organization;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'status' => $this->status,
            'role' => $this->primaryRole(),
            'organization' => $organization ? ['id' => $organization->id, 'name' => $organization->name] : null,
            'agency' => $agency ? ['id' => $agency->id, 'name' => $agency->name] : null,
            'created_at' => $this->created_at,
        ];
    }
}
