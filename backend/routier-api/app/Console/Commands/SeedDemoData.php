<?php

namespace App\Console\Commands;

use App\Enums\RoleName;
use App\Models\City;
use App\Models\Organization;
use App\Models\TravelClass;
use App\Models\User;
use Database\Seeders\DemoSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;
use Spatie\Permission\Models\Role;

/**
 * Données de démonstration sur un serveur en ligne (phase de test du client) : mêmes données que
 * DemoSeeder, mais avec un mot de passe saisi (jamais « password »). Une seule exécution.
 */
class SeedDemoData extends Command
{
    protected $signature = 'routier:seed-demo';

    protected $description = 'Crée les agences, comptes et trajets de démonstration avec un mot de passe choisi';

    public function handle(): int
    {
        if (Organization::where('slug', DemoSeeder::ORGANIZATION_SLUG)->exists()) {
            $this->components->info('Données de démonstration déjà présentes : rien à faire.');

            return self::SUCCESS;
        }

        if (! City::exists() || TravelClass::count() < 2 || Role::count() < count(RoleName::cases())) {
            $this->components->error('Référentiels absents : lancer d\'abord php artisan db:seed --force.');

            return self::FAILURE;
        }

        if (User::where('email', 'like', '%@'.DemoSeeder::EMAIL_DOMAIN)->exists()) {
            $this->components->error('Des comptes @'.DemoSeeder::EMAIL_DOMAIN.' existent déjà : création annulée.');

            return self::FAILURE;
        }

        $this->components->warn('Comptes fictifs (dont un super_admin) : à supprimer avant l\'ouverture au public.');

        if (! $this->confirm('Créer les données de démonstration sur '.config('app.url').' ?')) {
            return self::FAILURE;
        }

        $password = (string) $this->secret('Mot de passe commun des comptes de démonstration (12 caractères minimum)');

        $validator = Validator::make(
            ['password' => $password],
            ['password' => ['required', 'not_in:'.DemoSeeder::PASSWORD, Password::min(12)->letters()->numbers()]],
        );
        if ($validator->fails()) {
            $this->components->error($validator->errors()->first('password'));

            return self::FAILURE;
        }

        if ((string) $this->secret('Confirmer le mot de passe') !== $password) {
            $this->components->error('Les deux mots de passe ne correspondent pas.');

            return self::FAILURE;
        }

        $seeder = new DemoSeeder;
        $seeder->password = $password;

        DB::transaction(fn () => $seeder->run());

        $this->components->info('Données de démonstration créées.');
        $this->table(
            ['Compte', 'Espace'],
            User::where('email', 'like', '%@'.DemoSeeder::EMAIL_DOMAIN)->orderBy('id')->pluck('email')
                ->map(fn (string $email) => [$email, match (true) {
                    str_starts_with($email, 'admin@') => '/admin/login',
                    str_starts_with($email, 'client@') => '/login',
                    default => '/agency/login',
                }])->all(),
        );

        return self::SUCCESS;
    }
}
