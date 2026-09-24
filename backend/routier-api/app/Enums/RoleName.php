<?php

namespace App\Enums;

use App\Enums\PermissionName as P;

/**
 * Rôles fonctionnels de référence (cahier des charges §6), gérés par Spatie Permission.
 */
enum RoleName: string
{
    case SuperAdmin = 'super_admin';
    case Director = 'director';
    case AgencyManager = 'agency_manager';
    case CounterClerk = 'counter_clerk';
    case Accountant = 'accountant';
    case Driver = 'driver';
    case Customer = 'customer';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * Rôles du personnel d'une organisation (espace agence).
     *
     * @return list<self>
     */
    public static function internal(): array
    {
        return [self::Director, self::AgencyManager, self::CounterClerk, self::Accountant, self::Driver];
    }

    /**
     * Permissions attribuées par défaut au rôle (synchronisées par RoleSeeder).
     *
     * @return list<P>
     */
    public function permissions(): array
    {
        return match ($this) {
            self::SuperAdmin => P::cases(),
            self::Director => [
                P::DashboardView, P::OrganizationsView, P::OrganizationsUpdate,
                ...P::forModules('agencies', 'agency_settings', 'employees', 'vehicles', 'routes', 'trips', 'reservations'),
                P::PaymentsView,
            ],
            self::AgencyManager => [
                P::DashboardView, P::AgenciesView, P::AgencySettingsUpdate,
                ...P::forModules('employees', 'vehicles', 'routes', 'trips', 'reservations'),
                P::PaymentsView,
            ],
            self::CounterClerk => [
                P::DashboardView, P::TripsView, P::ReservationsView, P::ReservationsCancel, P::PaymentsView,
            ],
            self::Accountant => [
                P::DashboardView, P::TripsView, P::ReservationsView, P::PaymentsView, P::PaymentsRefund,
            ],
            self::Driver => [
                P::DashboardView, P::TripsView, P::VehiclesView,
            ],
            // Le client agit uniquement sur ses propres données, contrôlées par les policies.
            self::Customer => [],
        };
    }

    /**
     * Rôles que ce rôle peut attribuer à un membre du personnel (pas d'escalade de privilèges).
     *
     * @return list<self>
     */
    public function assignableRoles(): array
    {
        return match ($this) {
            self::SuperAdmin => [self::Director, self::AgencyManager, self::CounterClerk, self::Accountant, self::Driver],
            self::Director => [self::AgencyManager, self::CounterClerk, self::Accountant, self::Driver],
            self::AgencyManager => [self::CounterClerk, self::Accountant, self::Driver],
            default => [],
        };
    }
}
