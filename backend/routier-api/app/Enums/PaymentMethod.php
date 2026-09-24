<?php

namespace App\Enums;

/**
 * Moyens de paiement (cahier des charges §10).
 */
enum PaymentMethod: string
{
    case OrangeMoney = 'orange_money';
    case MtnMomo = 'mtn_momo';
    case Card = 'card';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
