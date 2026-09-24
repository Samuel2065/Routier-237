<?php

namespace App\Enums;

/**
 * Statut d'un employé d'agence.
 */
enum EmployeeStatus: string
{
    case Active = 'active';
    case Suspended = 'suspended';
    case Terminated = 'terminated';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
