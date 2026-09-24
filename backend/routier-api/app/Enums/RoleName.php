<?php

namespace App\Enums;

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
}
