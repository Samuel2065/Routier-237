<?php

namespace App\Enums;

/**
 * Statut d'un compte utilisateur.
 */
enum UserStatus: string
{
    case Active = 'active';
    case Suspended = 'suspended';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
