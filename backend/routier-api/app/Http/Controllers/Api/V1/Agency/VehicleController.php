<?php

namespace App\Http\Controllers\Api\V1\Agency;

use App\Actions\Vehicles\UpdateVehicle;
use App\Enums\VehicleStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Vehicles\StoreVehicleRequest;
use App\Http\Requests\Vehicles\UpdateVehicleRequest;
use App\Http\Resources\VehicleResource;
use App\Models\Vehicle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Flotte de véhicules des agences (/agency/vehicles), limitée au périmètre de l'utilisateur.
 */
class VehicleController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Vehicle::class);

        $request->validate([
            'agency_id' => ['sometimes', 'integer'],
            'travel_class_id' => ['sometimes', 'integer'],
            'status' => ['sometimes', Rule::enum(VehicleStatus::class)],
        ]);

        $vehicles = Vehicle::query()
            ->accessibleBy($request->user())
            ->with(['agency', 'travelClass'])
            ->withCount(['trips' => fn ($query) => $query->upcoming()])
            ->when($request->filled('agency_id'), fn ($query) => $query->where('agency_id', $request->integer('agency_id')))
            ->when($request->filled('travel_class_id'), fn ($query) => $query->where('travel_class_id', $request->integer('travel_class_id')))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->query('status')))
            ->orderBy('registration_number');

        return VehicleResource::collection(
            $this->applySearch($vehicles, $request, 'registration_number')->paginate($this->perPage($request))->withQueryString()
        );
    }

    public function store(StoreVehicleRequest $request): JsonResponse
    {
        $vehicle = new Vehicle($request->safe()->except('agency_id'));
        $vehicle->status ??= VehicleStatus::Active;
        $request->targetAgency()->vehicles()->save($vehicle);

        return (new VehicleResource($this->loadDetails($vehicle)))->response()->setStatusCode(201);
    }

    public function show(Vehicle $vehicle): VehicleResource
    {
        Gate::authorize('view', $vehicle);

        return new VehicleResource($this->loadDetails($vehicle));
    }

    public function update(UpdateVehicleRequest $request, Vehicle $vehicle, UpdateVehicle $updateVehicle): VehicleResource
    {
        $vehicle = $updateVehicle->handle($vehicle, $request->validated());

        return new VehicleResource($this->loadDetails($vehicle));
    }

    /**
     * Suppression réservée aux véhicules jamais utilisés : sinon l'historique des trajets
     * serait perdu. Un véhicule en service se met hors service (status = retired).
     */
    public function destroy(Vehicle $vehicle): Response
    {
        Gate::authorize('delete', $vehicle);

        abort_if(
            $vehicle->trips()->exists(),
            Response::HTTP_CONFLICT,
            'Ce véhicule a déjà des trajets : mettez-le hors service (statut « retired ») au lieu de le supprimer.',
        );

        $vehicle->delete();

        return response()->noContent();
    }

    private function loadDetails(Vehicle $vehicle): Vehicle
    {
        return $vehicle
            ->load(['agency', 'travelClass'])
            ->loadCount(['trips' => fn ($query) => $query->upcoming()]);
    }
}
