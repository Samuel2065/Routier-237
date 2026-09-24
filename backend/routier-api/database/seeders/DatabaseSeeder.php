<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Référentiels : toujours. Données de démonstration : jamais en production.
     */
    public function run(): void
    {
        $this->call([
            CitySeeder::class,
            TravelClassSeeder::class,
            RoleSeeder::class,
        ]);

        if (! app()->isProduction()) {
            $this->call(DemoSeeder::class);
        }
    }
}
