<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\ReservationStatus;
use App\Enums\TripStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\AdminPaymentResource;
use App\Http\Resources\AdminReservationResource;
use App\Http\Resources\TripResource;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Trip;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Supervision de l'activité de toute la plateforme (super_admin), en lecture seule :
 * trajets, réservations et paiements, filtrables par organisation et agence.
 *
 * Aucune action métier ici (annuler, rembourser…) : elles restent aux agences concernées.
 */
class ActivityController extends Controller
{
    public function trips(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Trip::class);

        $request->validate([
            ...$this->scopeRules(),
            'status' => ['sometimes', Rule::enum(TripStatus::class)],
            'date_from' => ['sometimes', 'date_format:Y-m-d'],
            'date_to' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:date_from'],
        ]);

        $trips = Trip::query()
            ->with(['agency.organization', 'route.departureCity', 'route.destinationCity', 'vehicle', 'travelClass'])
            ->withReservedSeats()
            ->when($request->filled('agency_id'), fn ($query) => $query->where('agency_id', $request->integer('agency_id')))
            ->when($request->filled('organization_id'), fn ($query) => $query->whereHas(
                'agency',
                fn ($agency) => $agency->where('organization_id', $request->integer('organization_id')),
            ))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->query('status')))
            ->when($request->filled('date_from'), fn ($query) => $query->whereDate('departure_date', '>=', $request->query('date_from')))
            ->when($request->filled('date_to'), fn ($query) => $query->whereDate('departure_date', '<=', $request->query('date_to')))
            ->orderByDesc('departure_date')
            ->orderByDesc('departure_time');

        return TripResource::collection($trips->paginate($this->perPage($request, 25))->withQueryString());
    }

    public function reservations(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Reservation::class);

        $request->validate([
            ...$this->scopeRules(),
            'status' => ['sometimes', Rule::enum(ReservationStatus::class)],
            'date' => ['sometimes', 'date_format:Y-m-d'],
            'search' => ['sometimes', 'nullable', 'string', 'max:30'],
        ]);

        $reservations = Reservation::query()
            ->with(['user', 'trip.agency.organization', 'trip.route.departureCity', 'trip.route.destinationCity'])
            ->tap(fn (Builder $query) => $this->scopeThroughTrip($query, $request))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->query('status')))
            ->when($request->filled('date'), fn ($query) => $query->whereHas(
                'trip',
                fn ($trip) => $trip->whereDate('departure_date', $request->query('date')),
            ))
            ->latest('id');

        return AdminReservationResource::collection(
            $this->applySearch($reservations, $request, 'reference')->paginate($this->perPage($request, 25))->withQueryString()
        );
    }

    public function payments(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Payment::class);

        $request->validate([
            ...$this->scopeRules(),
            'status' => ['sometimes', Rule::enum(PaymentStatus::class)],
            'method' => ['sometimes', Rule::enum(PaymentMethod::class)],
            'date_from' => ['sometimes', 'date_format:Y-m-d'],
            'date_to' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            'requires_refund' => ['sometimes', 'boolean'],
        ]);

        $payments = Payment::query()
            ->with(['reservation.trip.agency.organization'])
            ->when($request->filled('agency_id') || $request->filled('organization_id'), fn ($query) => $query->whereHas(
                'reservation',
                fn ($reservation) => $this->scopeThroughTrip($reservation, $request),
            ))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->query('status')))
            ->when($request->filled('method'), fn ($query) => $query->where('method', $request->query('method')))
            ->when($request->filled('date_from'), fn ($query) => $query->whereDate('created_at', '>=', $request->query('date_from')))
            ->when($request->filled('date_to'), fn ($query) => $query->whereDate('created_at', '<=', $request->query('date_to')))
            ->when($request->boolean('requires_refund'), fn ($query) => $query
                ->where('status', PaymentStatus::Paid)
                ->whereHas('reservation', fn ($reservation) => $reservation->where('status', '!=', ReservationStatus::Confirmed)))
            ->latest('id');

        return AdminPaymentResource::collection($payments->paginate($this->perPage($request, 25))->withQueryString());
    }

    /**
     * @return array<string, list<string>>
     */
    private function scopeRules(): array
    {
        return [
            'organization_id' => ['sometimes', 'integer'],
            'agency_id' => ['sometimes', 'integer'],
        ];
    }

    /**
     * Filtre organisation / agence d'une requête sur les réservations (via leur trajet).
     */
    private function scopeThroughTrip(Builder $query, Request $request): void
    {
        $query
            ->when($request->filled('agency_id'), fn ($query) => $query->whereHas(
                'trip',
                fn ($trip) => $trip->where('agency_id', $request->integer('agency_id')),
            ))
            ->when($request->filled('organization_id'), fn ($query) => $query->whereHas(
                'trip.agency',
                fn ($agency) => $agency->where('organization_id', $request->integer('organization_id')),
            ));
    }
}
