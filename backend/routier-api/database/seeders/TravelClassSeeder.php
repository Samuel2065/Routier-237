<?php

namespace Database\Seeders;

use App\Models\TravelClass;
use Illuminate\Database\Seeder;

/**
 * Classes commerciales initiales (cahier des charges §7.2), idempotent.
 */
class TravelClassSeeder extends Seeder
{
    public function run(): void
    {
        TravelClass::updateOrCreate(['code' => TravelClass::VIP], [
            'name' => 'VIP',
            'description' => 'Minibus/coaster plus confortable, généralement climatisé.',
        ]);

        TravelClass::updateOrCreate(['code' => TravelClass::CLASSIQUE], [
            'name' => 'Classique',
            'description' => 'Grand autocar, service standard.',
        ]);
    }
}
