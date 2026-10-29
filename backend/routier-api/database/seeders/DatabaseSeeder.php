<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Référentiels : toujours. Données de démonstration (mot de passe « password ») : uniquement
     * en local et en tests. Sur un serveur en ligne, même en staging : `routier:seed-demo`.
     */
    public function run(): void
    {
        $this->call([
            CitySeeder::class,
            TravelClassSeeder::class,
            RoleSeeder::class,
        ]);

        if (app()->environment('local', 'testing')) {
            $this->call(DemoSeeder::class);
        }
    }
}
