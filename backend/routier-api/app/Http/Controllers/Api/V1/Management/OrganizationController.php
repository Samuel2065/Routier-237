<?php

namespace App\Http\Controllers\Api\V1\Management;

use App\Actions\Organizations\CreateOrganization;
use App\Enums\RecordStatus;
use App\Enums\RoleName;
use App\Http\Controllers\Controller;
use App\Http\Requests\Organizations\StoreOrganizationRequest;
use App\Http\Requests\Organizations\UpdateOrganizationRequest;
use App\Http\Resources\OrganizationResource;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Organisations : liste et création par la plateforme (/admin/organizations),
 * consultation et mise à jour de son organisation par le director (/agency/organizations/{id}).
 * Pas de suppression : une organisation se suspend (status = inactive).
 */
class OrganizationController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Organization::class);

        $request->validate(['status' => ['sometimes', Rule::enum(RecordStatus::class)]]);

        $organizations = Organization::query()
            ->withCount('agencies')
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->query('status')))
            ->orderBy('name');

        return OrganizationResource::collection(
            $this->applySearch($organizations, $request)->paginate($this->perPage($request))->withQueryString()
        );
    }

    public function store(StoreOrganizationRequest $request, CreateOrganization $createOrganization): JsonResponse
    {
        $organization = $createOrganization->handle($request->validated());

        return (new OrganizationResource($organization))->response()->setStatusCode(201);
    }

    public function show(Organization $organization): OrganizationResource
    {
        Gate::authorize('view', $organization);

        return new OrganizationResource($this->loadDetails($organization));
    }

    public function update(UpdateOrganizationRequest $request, Organization $organization): OrganizationResource
    {
        $organization->update($request->validated());

        return new OrganizationResource($this->loadDetails($organization));
    }

    private function loadDetails(Organization $organization): Organization
    {
        return $organization
            ->loadCount('agencies')
            ->load([
                'agencies' => fn ($query) => $query->with('city')->orderBy('name'),
                'users' => fn ($query) => $query->role(RoleName::Director->value)->orderBy('name'),
            ]);
    }
}
