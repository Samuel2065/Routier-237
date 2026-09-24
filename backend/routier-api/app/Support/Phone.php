<?php

namespace App\Support;

/**
 * Numéros de téléphone camerounais : 9 chiffres commençant par 2 ou 6,
 * préfixe +237 facultatif. Espaces, points et tirets sont retirés avant validation.
 */
final class Phone
{
    public const REGEX = '/^(\+237)?[26]\d{8}$/';

    public static function normalize(mixed $value): mixed
    {
        return is_string($value) ? preg_replace('/[\s.-]/', '', $value) : $value;
    }
}
