<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Actions\Reservations\ChangeReservationStatus;
use App\Actions\Reservations\CreateReservation;
use App\Enums\ReservationStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Reservations\StoreReservationRequest;
use App\Http\Resources\ReservationResource;
use App\Models\Reservation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Réservations du client connecté (/account/reservations). Un client ne voit
 * que ses propres réservations (critère A9).
 */
class ReservationController extends Controller
{
    private const RELATIONS = [
        'trip.agency', 'trip.route.departureCity', 'trip.route.destinationCity', 'trip.travelClass',
    ];

    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Reservation::class);

        $request->validate(['status' => ['sometimes', Rule::enum(ReservationStatus::class)]]);

        $reservations = Reservation::query()
            ->accessibleBy($request->user())
            ->with(self::RELATIONS)
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->query('status')))
            ->latest('id');

        return ReservationResource::collection($reservations->paginate($this->perPage($request))->withQueryString());
    }

    public function store(StoreReservationRequest $request, CreateReservation $createReservation): JsonResponse
    {
        $reservation = $createReservation->handle(
            $request->user(),
            $request->integer('trip_id'),
            $request->passengers(),
        );

        return (new ReservationResource($this->details($reservation)))->response()->setStatusCode(201);
    }

    public function show(Reservation $reservation): ReservationResource
    {
        Gate::authorize('view', $reservation);

        return new ReservationResource($this->details($reservation));
    }

    public function cancel(Reservation $reservation, ChangeReservationStatus $changeStatus): ReservationResource
    {
        Gate::authorize('cancel', $reservation);

        return new ReservationResource($this->details($changeStatus->cancel($reservation, byCustomer: true)));
    }

    private function details(Reservation $reservation): Reservation
    {
        return $reservation->load([...self::RELATIONS, 'passengers', 'payments']);
    }
}
