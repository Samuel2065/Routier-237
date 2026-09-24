<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\PaymentStatus;
use App\Enums\RecordStatus;
use App\Enums\ReservationStatus;
use App\Enums\RoleName;
use App\Enums\TripStatus;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Trip;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Supervision de la plateforme (/admin/dashboard) : indicateurs globaux, toutes organisations.
 */
class DashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        abort_unless($request->user()->isSuperAdmin(), 403);

        $today = today();

        return response()->json(['data' => [
            'organizations' => [
                'active' => Organization::query()->where('status', RecordStatus::Active)->count(),
                'inactive' => Organization::query()->where('status', RecordStatus::Inactive)->count(),
            ],
            'agencies' => [
                'active' => Agency::query()->where('status', RecordStatus::Active)->count(),
                'inactive' => Agency::query()->where('status', RecordStatus::Inactive)->count(),
            ],
            'users' => [
                'customers' => User::query()->role(RoleName::Customer->value)->count(),
                'staff' => User::query()->role(array_map(fn (RoleName $role) => $role->value, RoleName::internal()))->count(),
                'suspended' => User::query()->where('status', UserStatus::Suspended)->count(),
            ],
            'trips' => [
                'published_next_7_days' => Trip::query()
                    ->where('status', TripStatus::Published)
                    ->whereBetween('departure_date', [$today->toDateString(), $today->copy()->addDays(6)->toDateString()])
                    ->count(),
            ],
            'reservations' => [
                'confirmed_last_30_days' => Reservation::query()
                    ->where('status', ReservationStatus::Confirmed)
                    ->where('confirmed_at', '>=', now()->subDays(30))
                    ->count(),
                'pending' => Reservation::query()->consumingCapacity()->where('status', ReservationStatus::Pending)->count(),
            ],
            'payments' => [
                'paid_this_month_amount' => (int) Payment::query()
                    ->where('status', PaymentStatus::Paid)
                    ->where('paid_at', '>=', now()->startOfMonth())
                    ->sum('amount'),
                'requires_refund' => Payment::query()
                    ->where('status', PaymentStatus::Paid)
                    ->whereHas('reservation', fn ($query) => $query->where('status', '!=', ReservationStatus::Confirmed))
                    ->count(),
            ],
        ]]);
    }
}
