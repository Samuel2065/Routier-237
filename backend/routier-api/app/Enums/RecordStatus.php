<?php

namespace App\Enums;

/**
 * Statut générique d'un référentiel (organisations, agences, itinéraires, permis).
 */
enum RecordStatus: string
{
    case Active = 'active';
    case Inactive = 'inactive';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
