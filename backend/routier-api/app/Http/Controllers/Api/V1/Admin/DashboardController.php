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
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Supervision de la plateforme (/admin/dashboard) : indicateurs globaux, toutes organisations.
 */
class DashboardController extends Controller
{
    /** Fenêtre d'activité du personnel, en minutes. */
    private const ACTIVE_WINDOW_MINUTES = 15;

    private const ACTIVE_STAFF_LIMIT = 10;

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
            'active_staff' => $this->activeStaff(),
        ]]);
    }

    /**
     * Personnel actif : comptes internes actifs dont un jeton valide a servi récemment
     * (Sanctum met à jour last_used_at à chaque requête authentifiée).
     *
     * @return array<string, mixed>
     */
    private function activeStaff(): array
    {
        $activity = PersonalAccessToken::query()
            ->where('tokenable_type', (new User)->getMorphClass())
            ->where('last_used_at', '>=', now()->subMinutes(self::ACTIVE_WINDOW_MINUTES))
            ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->selectRaw('tokenable_id, MAX(last_used_at) as last_active_at')
            ->groupBy('tokenable_id');

        $staff = User::query()
            ->role(array_map(fn (RoleName $role) => $role->value, RoleName::internal()))
            ->where('users.status', UserStatus::Active)
            ->joinSub($activity, 'activity', 'activity.tokenable_id', '=', 'users.id');

        $users = (clone $staff)
            ->select('users.*', 'activity.last_active_at')
            ->orderByDesc('activity.last_active_at')
            ->limit(self::ACTIVE_STAFF_LIMIT)
            ->with(['roles', 'organization', 'employeeProfile.agency.organization'])
            ->get();

        return [
            'window_minutes' => self::ACTIVE_WINDOW_MINUTES,
            'count' => $staff->count(),
            'users' => $users->map(function (User $user) {
                $agency = $user->employeeProfile?->agency;

                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'role' => $user->primaryRole(),
                    'avatar_url' => $user->avatar_path ? Storage::disk('public')->url($user->avatar_path) : null,
                    'agency' => $agency?->name,
                    'organization' => ($user->organization ?? $agency?->organization)?->name,
                    'last_active_at' => Carbon::parse($user->getAttribute('last_active_at'))->toIso8601String(),
                ];
            })->values(),
        ];
    }
}
