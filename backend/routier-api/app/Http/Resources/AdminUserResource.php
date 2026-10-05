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
            // Détail d'un compte (GET admin/users/{id}) : permissions issues du rôle (lecture seule),
            // activité et sessions ouvertes. Jamais de mot de passe ni de jeton.
            'permissions' => $this->when(
                $this->relationLoaded('roles') && $this->roles->every(fn ($role) => $role->relationLoaded('permissions')),
                fn () => $this->getAllPermissions()->pluck('name')->sort()->values(),
            ),
            'last_active_at' => $this->when(array_key_exists('tokens_max_last_used_at', $this->getAttributes()), fn () => $this->tokens_max_last_used_at),
            'active_sessions' => $this->when(array_key_exists('active_sessions_count', $this->getAttributes()), fn () => $this->active_sessions_count),
            'push_devices' => $this->when(array_key_exists('device_tokens_count', $this->getAttributes()), fn () => $this->device_tokens_count),
        ];
    }
}
