<?php

namespace App\Http\Controllers\Api\V1\Agency;

use App\Actions\Trips\ChangeTripStatus;
use App\Actions\Trips\SaveTrip;
use App\Enums\TripStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Trips\StoreTripRequest;
use App\Http\Requests\Trips\UpdateTripRequest;
use App\Http\Resources\TripResource;
use App\Models\Trip;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Gestion des trajets par les agences (/agency/trips) : planification et publication.
 */
class TripController extends Controller
{
    public function __construct(private readonly ChangeTripStatus $changeStatus) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Trip::class);

        $request->validate([
            'agency_id' => ['sometimes', 'integer'],
            'route_id' => ['sometimes', 'integer'],
            'vehicle_id' => ['sometimes', 'integer'],
            'travel_class_id' => ['sometimes', 'integer'],
            'status' => ['sometimes', Rule::enum(TripStatus::class)],
            'date_from' => ['sometimes', 'date_format:Y-m-d'],
            'date_to' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:date_from'],
        ]);

        $trips = $this->withDetails(Trip::query()->accessibleBy($request->user()))
            ->when($request->filled('agency_id'), fn ($query) => $query->where('agency_id', $request->integer('agency_id')))
            ->when($request->filled('route_id'), fn ($query) => $query->where('route_id', $request->integer('route_id')))
            ->when($request->filled('vehicle_id'), fn ($query) => $query->where('vehicle_id', $request->integer('vehicle_id')))
            ->when($request->filled('travel_class_id'), fn ($query) => $query->where('travel_class_id', $request->integer('travel_class_id')))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->query('status')))
            ->when($request->filled('date_from'), fn ($query) => $query->whereDate('departure_date', '>=', $request->query('date_from')))
            ->when($request->filled('date_to'), fn ($query) => $query->whereDate('departure_date', '<=', $request->query('date_to')))
            ->orderBy('departure_date')
            ->orderBy('departure_time');

        return TripResource::collection($trips->paginate($this->perPage($request, 25))->withQueryString());
    }

    public function store(StoreTripRequest $request, SaveTrip $saveTrip): JsonResponse
    {
        // Création et publication éventuelle : tout ou rien.
        $trip = DB::transaction(function () use ($request, $saveTrip) {
            $trip = $saveTrip->handle(new Trip, $request->safe()->except(['agency_id', 'status']), $request->targetAgency());

            return $request->wantsPublication()
                ? $this->changeStatus->handle($trip, TripStatus::Published)
                : $trip;
        });

        return (new TripResource($this->fresh($trip)))->response()->setStatusCode(201);
    }

    public function show(Trip $trip): TripResource
    {
        Gate::authorize('view', $trip);

        return new TripResource($this->fresh($trip));
    }

    public function update(UpdateTripRequest $request, Trip $trip, SaveTrip $saveTrip): TripResource
    {
        return new TripResource($this->fresh($saveTrip->handle($trip, $request->validated())));
    }

    /**
     * Seuls les brouillons sans réservation se suppriment ; sinon on annule.
     */
    public function destroy(Trip $trip): Response
    {
        Gate::authorize('delete', $trip);

        abort_unless(
            $trip->status === TripStatus::Draft && ! $trip->reservations()->exists(),
            Response::HTTP_CONFLICT,
            'Seul un brouillon sans réservation peut être supprimé : annulez ce trajet.',
        );

        $trip->delete();

        return response()->noContent();
    }

    public function publish(Trip $trip): TripResource
    {
        Gate::authorize('publish', $trip);

        return $this->transition($trip, TripStatus::Published);
    }

    public function unpublish(Trip $trip): TripResource
    {
        Gate::authorize('publish', $trip);

        return $this->transition($trip, TripStatus::Draft);
    }

    public function cancel(Trip $trip): TripResource
    {
        Gate::authorize('cancel', $trip);

        return $this->transition($trip, TripStatus::Cancelled);
    }

    public function complete(Trip $trip): TripResource
    {
        Gate::authorize('complete', $trip);

        return $this->transition($trip, TripStatus::Completed);
    }

    private function transition(Trip $trip, TripStatus $target): TripResource
    {
        return new TripResource($this->fresh($this->changeStatus->handle($trip, $target)));
    }

    private function fresh(Trip $trip): Trip
    {
        return $this->withDetails(Trip::query())->findOrFail($trip->getKey());
    }

    /**
     * @param  Builder<Trip>  $query
     * @return Builder<Trip>
     */
    private function withDetails(Builder $query): Builder
    {
        return $query
            ->with(['agency', 'route.departureCity', 'route.destinationCity', 'vehicle', 'travelClass'])
            ->withReservedSeats();
    }
}
