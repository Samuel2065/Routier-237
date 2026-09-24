<?php

namespace App\Http\Controllers\Api\V1\Public;

use App\Enums\TripStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Trips\SearchTripsRequest;
use App\Http\Resources\CityResource;
use App\Http\Resources\PublicTripResource;
use App\Models\Agency;
use App\Models\City;
use App\Models\TravelRoute;
use App\Models\Trip;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Recherche et consultation publiques des trajets, sans compte (§4.1, §5.1).
 *
 * Neutralité (§18.3) : aucun classement subjectif ; tri uniquement sur des données
 * observables (heure de départ par défaut, ou prix).
 */
class TripController extends Controller
{
    private const MAX_RESULTS = 100;

    public function search(SearchTripsRequest $request): AnonymousResourceCollection
    {
        $routeIds = TravelRoute::query()
            ->select('id')
            ->where('departure_city_id', $request->integer('departure_city_id'))
            ->where('destination_city_id', $request->integer('destination_city_id'));

        $trips = $this->withPublicDetails(Trip::query())
            ->publiclyAvailable()
            ->whereIn('trips.route_id', $routeIds)
            ->whereDate('trips.departure_date', $request->validated('date'))
            ->when($request->filled('travel_class_id'), fn ($query) => $query->where('trips.travel_class_id', $request->integer('travel_class_id')))
            ->withRemainingSeatsAtLeast($request->passengers())
            ->when(
                $request->validated('sort') === 'price',
                fn ($query) => $query->orderBy('trips.price')->orderBy('trips.departure_time'),
                fn ($query) => $query->orderBy('trips.departure_time')->orderBy('trips.price'),
            )
            ->orderBy('trips.id')
            ->limit(self::MAX_RESULTS)
            ->get();

        return PublicTripResource::collection($trips)->additional([
            'meta' => [
                'departure_city' => new CityResource(City::find($request->integer('departure_city_id'))),
                'destination_city' => new CityResource(City::find($request->integer('destination_city_id'))),
                'date' => $request->validated('date'),
                'passengers' => $request->passengers(),
                'count' => $trips->count(),
            ],
        ]);
    }

    /**
     * Détail public d'un trajet publié (§13.1 /trips/:id). Un trajet non publié ou
     * d'une agence non visible n'existe pas publiquement.
     */
    public function show(int $trip): PublicTripResource
    {
        $trip = $this->withPublicDetails(Trip::query())->findOrFail($trip);

        abort_unless(
            $trip->status === TripStatus::Published && $trip->agency->isPubliclyVisible(),
            404,
        );

        return (new PublicTripResource($trip))->detailed();
    }

    /**
     * Trajets publiés à venir d'une agence (page publique d'agence, §13.1 /agencies/:id).
     */
    public function forAgency(Request $request, Agency $agency): AnonymousResourceCollection
    {
        abort_unless($agency->isPubliclyVisible(), 404);

        $request->validate(['date' => ['sometimes', 'date_format:Y-m-d']]);

        $trips = $this->withPublicDetails(Trip::query())
            ->publiclyAvailable()
            ->where('trips.agency_id', $agency->id)
            ->when($request->filled('date'), fn ($query) => $query->whereDate('trips.departure_date', $request->query('date')))
            ->withRemainingSeatsAtLeast(1)
            ->orderBy('trips.departure_date')
            ->orderBy('trips.departure_time')
            ->orderBy('trips.id');

        return PublicTripResource::collection($trips->paginate($this->perPage($request, 20, 50))->withQueryString());
    }

    /**
     * @param  Builder<Trip>  $query
     * @return Builder<Trip>
     */
    private function withPublicDetails(Builder $query): Builder
    {
        return $query
            ->with(['agency.city', 'agency.organization', 'route.departureCity', 'route.destinationCity', 'travelClass', 'vehicle'])
            ->withReservedSeats();
    }
}
