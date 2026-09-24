<?php

namespace App\Enums;

/**
 * Statut d'exploitation d'un véhicule.
 */
enum VehicleStatus: string
{
    case Active = 'active';
    case Maintenance = 'maintenance';
    case Retired = 'retired';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
