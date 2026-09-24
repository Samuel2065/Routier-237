<?php

namespace App\Http\Controllers\Api\V1\Agency;

use App\Actions\Reservations\ChangeReservationStatus;
use App\Enums\ReservationStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\ReservationResource;
use App\Models\Reservation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Réservations des trajets de l'agence (/agency/reservations), limitées au périmètre
 * de l'utilisateur (critère A10). La confirmation passe par le paiement (module 8).
 */
class ReservationController extends Controller
{
    private const RELATIONS = [
        'user', 'trip.agency', 'trip.route.departureCity', 'trip.route.destinationCity', 'trip.travelClass',
    ];

    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Reservation::class);

        $request->validate([
            'trip_id' => ['sometimes', 'integer'],
            'status' => ['sometimes', Rule::enum(ReservationStatus::class)],
            'date' => ['sometimes', 'date_format:Y-m-d'],
            'search' => ['sometimes', 'nullable', 'string', 'max:30'],
        ]);

        $reservations = Reservation::query()
            ->accessibleBy($request->user())
            ->with(self::RELATIONS)
            ->withCount('passengers')
            ->when($request->filled('trip_id'), fn ($query) => $query->where('trip_id', $request->integer('trip_id')))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->query('status')))
            ->when($request->filled('date'), fn ($query) => $query->whereHas(
                'trip',
                fn ($trip) => $trip->whereDate('departure_date', $request->query('date')),
            ))
            ->latest('id');

        return ReservationResource::collection(
            $this->applySearch($reservations, $request, 'reference')->paginate($this->perPage($request, 25))->withQueryString()
        );
    }

    public function show(Reservation $reservation): ReservationResource
    {
        Gate::authorize('view', $reservation);

        return new ReservationResource($reservation->load([...self::RELATIONS, 'passengers']));
    }

    public function cancel(Reservation $reservation, ChangeReservationStatus $changeStatus): ReservationResource
    {
        Gate::authorize('cancel', $reservation);

        $reservation = $changeStatus->cancel($reservation, byCustomer: false);

        return new ReservationResource($reservation->load([...self::RELATIONS, 'passengers']));
    }
}
