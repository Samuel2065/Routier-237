<?php

namespace App\Enums;

/**
 * Statut de publication d'un trajet (cahier des charges §7.4).
 */
enum TripStatus: string
{
    case Draft = 'draft';
    case Published = 'published';
    case Cancelled = 'cancelled';
    case Completed = 'completed';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
