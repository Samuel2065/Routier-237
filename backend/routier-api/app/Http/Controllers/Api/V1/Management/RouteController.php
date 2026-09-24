<?php

namespace App\Http\Controllers\Api\V1\Management;

use App\Enums\RecordStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Routes\StoreRouteRequest;
use App\Http\Requests\Routes\UpdateRouteRequest;
use App\Http\Resources\RouteResource;
use App\Models\TravelRoute;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Référentiel des itinéraires, partagé par les espaces agence (consultation, création)
 * et admin (modification, désactivation).
 */
class RouteController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', TravelRoute::class);

        $request->validate([
            'departure_city_id' => ['sometimes', 'integer'],
            'destination_city_id' => ['sometimes', 'integer'],
            'status' => ['sometimes', Rule::enum(RecordStatus::class)],
        ]);

        $routes = TravelRoute::query()
            ->with(['departureCity', 'destinationCity'])
            ->when($request->filled('departure_city_id'), fn ($query) => $query->where('departure_city_id', $request->integer('departure_city_id')))
            ->when($request->filled('destination_city_id'), fn ($query) => $query->where('destination_city_id', $request->integer('destination_city_id')))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->query('status')))
            ->orderBy('id');

        return RouteResource::collection($routes->paginate($this->perPage($request, 50))->withQueryString());
    }

    public function store(StoreRouteRequest $request): JsonResponse
    {
        $route = new TravelRoute($request->validated());
        $route->status = RecordStatus::Active;
        $route->save();

        return (new RouteResource($route->load(['departureCity', 'destinationCity'])))
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdateRouteRequest $request, TravelRoute $travelRoute): RouteResource
    {
        $travelRoute->update($request->validated());

        return new RouteResource($travelRoute->load(['departureCity', 'destinationCity']));
    }
}
