<?php

namespace App\Http\Controllers\Api\V1\Management;

use App\Actions\Agencies\CreateAgency;
use App\Enums\RecordStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Agencies\StoreAgencyRequest;
use App\Http\Requests\Agencies\UpdateAgencyRequest;
use App\Http\Requests\Agencies\UpdateAgencySettingsRequest;
use App\Http\Resources\AgencyResource;
use App\Models\Agency;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Agences, partagé par les espaces admin (/admin/agencies : toutes les organisations)
 * et agence (/agency/agencies : périmètre du director ou de l'employé).
 * Le filtrage (accessibleBy) et les policies s'adaptent à l'utilisateur connecté.
 */
class AgencyController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Agency::class);

        $request->validate([
            'organization_id' => ['sometimes', 'integer'],
            'city_id' => ['sometimes', 'integer'],
            'status' => ['sometimes', Rule::enum(RecordStatus::class)],
        ]);

        $agencies = Agency::query()
            ->accessibleBy($request->user())
            ->with(['organization', 'city'])
            ->withCount(['employeeProfiles', 'vehicles'])
            ->when($request->filled('organization_id'), fn ($query) => $query->where('organization_id', $request->integer('organization_id')))
            ->when($request->filled('city_id'), fn ($query) => $query->where('city_id', $request->integer('city_id')))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->query('status')))
            ->orderBy('name');

        return AgencyResource::collection(
            $this->applySearch($agencies, $request)->paginate($this->perPage($request))->withQueryString()
        );
    }

    public function store(StoreAgencyRequest $request, CreateAgency $createAgency): JsonResponse
    {
        $organization = Organization::findOrFail($request->targetOrganizationId());

        $agency = $createAgency->handle($organization, $request->safe()->except('organization_id'));

        return (new AgencyResource($agency->load(['organization', 'city'])))->response()->setStatusCode(201);
    }

    public function show(Agency $agency): AgencyResource
    {
        Gate::authorize('view', $agency);

        return new AgencyResource($agency->load(['organization', 'city'])->loadCount(['employeeProfiles', 'vehicles']));
    }

    public function update(UpdateAgencyRequest $request, Agency $agency): AgencyResource
    {
        $agency->update($request->validated());

        return new AgencyResource($agency->load(['organization', 'city'])->loadCount(['employeeProfiles', 'vehicles']));
    }

    /**
     * Paramètres de l'agence par son responsable (/agency/settings).
     */
    public function updateSettings(UpdateAgencySettingsRequest $request, Agency $agency): AgencyResource
    {
        $agency->update($request->validated());

        return new AgencyResource($agency->load(['organization', 'city']));
    }
}
