<?php

namespace App\Enums;

/**
 * Type de passager. Un enfant peut voyager sans compte client.
 */
enum PassengerType: string
{
    case Adult = 'adult';
    case Child = 'child';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
