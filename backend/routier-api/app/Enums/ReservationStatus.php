<?php

namespace App\Enums;

/**
 * Statut d'une réservation (cahier des charges §9.3). Les transitions sont contrôlées côté backend (module 7).
 */
enum ReservationStatus: string
{
    case Pending = 'pending';
    case Confirmed = 'confirmed';
    case Cancelled = 'cancelled';
    case Expired = 'expired';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
