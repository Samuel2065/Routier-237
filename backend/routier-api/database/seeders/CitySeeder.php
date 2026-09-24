<?php

namespace Database\Seeders;

use App\Models\City;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Villes camerounaises utiles au développement (idempotent).
 */
class CitySeeder extends Seeder
{
    public const CITIES = [
        'Yaoundé', 'Douala', 'Bertoua', 'Batouri', 'Bafoussam', 'Bamenda', 'Buea',
        'Limbé', 'Kribi', 'Ebolowa', 'Ngaoundéré', 'Garoua', 'Maroua', 'Dschang',
    ];

    public function run(): void
    {
        foreach (self::CITIES as $name) {
            City::updateOrCreate(['slug' => Str::slug($name)], ['name' => $name]);
        }
    }
}
