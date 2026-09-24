<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\RoleName;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\AdminUserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Comptes utilisateurs de la plateforme (/admin/users) : consultation et contrôle d'accès
 * (suspension / réactivation). Rôles et rattachements se gèrent dans les espaces dédiés
 * (organisations, personnel des agences).
 */
class UserController extends Controller
{
    private const RELATIONS = ['roles', 'organization', 'employeeProfile.agency.organization'];

    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', User::class);

        $request->validate([
            'role' => ['sometimes', Rule::enum(RoleName::class)],
            'status' => ['sometimes', Rule::enum(UserStatus::class)],
            'organization_id' => ['sometimes', 'integer'],
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
        ]);

        $search = trim((string) $request->query('search', ''));
        $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search);
        $organizationId = $request->integer('organization_id');

        $users = User::query()
            ->with(self::RELATIONS)
            ->when($request->filled('role'), fn ($query) => $query->role($request->query('role')))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->query('status')))
            ->when($search !== '', fn ($query) => $query->where(fn ($query) => $query
                ->where('name', 'like', "%{$escaped}%")
                ->orWhere('email', 'like', "%{$escaped}%")
                ->orWhere('phone', 'like', "%{$escaped}%")))
            ->when($organizationId > 0, fn ($query) => $query->where(fn ($query) => $query
                ->where('organization_id', $organizationId)
                ->orWhereHas('employeeProfile.agency', fn ($agency) => $agency->where('organization_id', $organizationId))))
            ->latest('id');

        return AdminUserResource::collection($users->paginate($this->perPage($request, 25))->withQueryString());
    }

    public function show(User $user): AdminUserResource
    {
        Gate::authorize('view', $user);

        return new AdminUserResource($user->load(self::RELATIONS));
    }

    /**
     * Suspension ou réactivation d'un compte. Une suspension révoque immédiatement ses jetons.
     */
    public function update(Request $request, User $user): AdminUserResource
    {
        Gate::authorize('update', $user);

        $data = $request->validate([
            'status' => ['required', Rule::enum(UserStatus::class)],
        ]);

        DB::transaction(function () use ($user, $data) {
            $user->status = UserStatus::from($data['status']);
            $user->save();

            if ($user->status !== UserStatus::Active) {
                $user->tokens()->delete();
            }
        });

        return new AdminUserResource($user->load(self::RELATIONS));
    }
}
