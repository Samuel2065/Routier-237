<?php

namespace App\Enums;

/**
 * Permissions structurées par module et action (cahier des charges §21.1).
 *
 * Une permission ne suffit jamais : les policies vérifient aussi le périmètre
 * (organisation/agence) de la ressource.
 */
enum PermissionName: string
{
    case DashboardView = 'dashboard.view';

    case OrganizationsView = 'organizations.view';
    case OrganizationsCreate = 'organizations.create';
    case OrganizationsUpdate = 'organizations.update';

    case AgenciesView = 'agencies.view';
    case AgenciesCreate = 'agencies.create';
    case AgenciesUpdate = 'agencies.update';
    case AgencySettingsUpdate = 'agency_settings.update';

    case UsersView = 'users.view';
    case UsersUpdate = 'users.update';

    case EmployeesView = 'employees.view';
    case EmployeesCreate = 'employees.create';
    case EmployeesUpdate = 'employees.update';

    case VehiclesView = 'vehicles.view';
    case VehiclesCreate = 'vehicles.create';
    case VehiclesUpdate = 'vehicles.update';
    case VehiclesDelete = 'vehicles.delete';

    case RoutesView = 'routes.view';
    case RoutesManage = 'routes.manage';

    case TripsView = 'trips.view';
    case TripsCreate = 'trips.create';
    case TripsUpdate = 'trips.update';
    case TripsPublish = 'trips.publish';
    case TripsCancel = 'trips.cancel';

    case ReservationsView = 'reservations.view';
    case ReservationsCancel = 'reservations.cancel';

    case PaymentsView = 'payments.view';
    case PaymentsRefund = 'payments.refund';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * Toutes les permissions d'un module, ex. forModules('trips', 'vehicles').
     *
     * @return list<self>
     */
    public static function forModules(string ...$modules): array
    {
        return array_values(array_filter(
            self::cases(),
            fn (self $permission) => in_array(explode('.', $permission->value)[0], $modules, true),
        ));
    }
}
