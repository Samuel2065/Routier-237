<?php

namespace App\Actions\Dashboard;

use App\Enums\PaymentStatus;
use App\Enums\PermissionName as P;
use App\Enums\ReservationStatus;
use App\Enums\TripStatus;
use App\Enums\VehicleStatus;
use App\Models\Agency;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Trip;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Builder;

/**
 * Indicateurs du tableau de bord de l'espace agence, limités au périmètre de l'utilisateur
 * (et éventuellement à une agence de ce périmètre). Chaque bloc n'est calculé que si
 * l'utilisateur a la permission de consulter les données correspondantes.
 */
class BuildAgencyDashboard
{
    private const NEXT_DEPARTURES = 6;

    /**
     * @return array<string, mixed>
     */
    public function handle(User $user, ?Agency $agency = null): array
    {
        $today = today();
        $weekEnd = today()->addDays(6);

        $scope = function (Builder $query, string $column = 'agency_id') use ($user, $agency): Builder {
            $query->accessibleBy($user);

            return $agency ? $query->where($column, $agency->id) : $query;
        };

        $trips = fn () => $scope(Trip::query());

        return [
            'agency' => $agency ? ['id' => $agency->id, 'name' => $agency->name] : null,
            'trips' => [
                'today' => $trips()->whereDate('departure_date', $today)->where('status', TripStatus::Published)->count(),
                'published_next_7_days' => $trips()
                    ->whereBetween('departure_date', [$today->toDateString(), $weekEnd->toDateString()])
                    ->where('status', TripStatus::Published)
                    ->count(),
                'drafts' => $trips()->upcoming()->where('status', TripStatus::Draft)->count(),
            ],
            'next_departures' => $trips()
                ->publiclyAvailable()
                ->with(['route.departureCity', 'route.destinationCity', 'vehicle', 'travelClass', 'agency'])
                ->withReservedSeats()
                ->orderBy('departure_date')
                ->orderBy('departure_time')
                ->limit(self::NEXT_DEPARTURES)
                ->get()
                ->map(fn (Trip $trip) => [
                    'id' => $trip->id,
                    'agency' => $trip->agency->name,
                    'departure_city' => $trip->route->departureCity->name,
                    'destination_city' => $trip->route->destinationCity->name,
                    'departure_date' => $trip->departure_date->toDateString(),
                    'departure_time' => substr($trip->departure_time, 0, 5),
                    'travel_class' => $trip->travelClass->name,
                    'capacity' => $trip->capacity(),
                    'reserved_seats' => $trip->reservedSeats(),
                ]),
            'reservations' => $user->checkPermissionTo(P::ReservationsView->value) ? $this->reservations($user, $agency) : null,
            'payments' => $user->checkPermissionTo(P::PaymentsView->value) ? $this->payments($user, $agency) : null,
            'fleet' => $user->checkPermissionTo(P::VehiclesView->value) ? [
                'active' => $scope(Vehicle::query())->where('status', VehicleStatus::Active)->count(),
                'maintenance' => $scope(Vehicle::query())->where('status', VehicleStatus::Maintenance)->count(),
            ] : null,
        ];
    }

    /**
     * @return array<string, int>
     */
    private function reservations(User $user, ?Agency $agency): array
    {
        $query = fn () => Reservation::query()
            ->accessibleBy($user)
            ->when($agency, fn ($q) => $q->whereIn('trip_id', Trip::query()->select('id')->where('agency_id', $agency->id)));

        return [
            'pending' => $query()->consumingCapacity()->where('status', ReservationStatus::Pending)->count(),
            'confirmed_last_7_days' => $query()
                ->where('status', ReservationStatus::Confirmed)
                ->where('confirmed_at', '>=', now()->subDays(7))
                ->count(),
            'passengers_upcoming' => (int) $query()
                ->where('status', ReservationStatus::Confirmed)
                ->whereIn('trip_id', Trip::query()->select('id')->upcoming())
                ->sum('passenger_count'),
        ];
    }

    /**
     * @return array<string, int>
     */
    private function payments(User $user, ?Agency $agency): array
    {
        $query = fn () => Payment::query()
            ->accessibleBy($user)
            ->when($agency, fn ($q) => $q->whereIn(
                'reservation_id',
                Reservation::query()->select('id')->whereIn('trip_id', Trip::query()->select('id')->where('agency_id', $agency->id)),
            ));

        $paidThisMonth = $query()->where('status', PaymentStatus::Paid)->where('paid_at', '>=', now()->startOfMonth());

        return [
            'paid_this_month_amount' => (int) (clone $paidThisMonth)->sum('amount'),
            'paid_this_month_count' => (clone $paidThisMonth)->count(),
            'requires_refund' => $query()
                ->where('status', PaymentStatus::Paid)
                ->whereHas('reservation', fn ($q) => $q->where('status', '!=', ReservationStatus::Confirmed))
                ->count(),
        ];
    }
}
