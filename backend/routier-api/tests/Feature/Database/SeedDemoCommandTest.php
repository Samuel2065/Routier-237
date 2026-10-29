<?php

namespace Tests\Feature\Database;

use App\Models\Organization;
use App\Models\Trip;
use App\Models\User;
use Database\Seeders\CitySeeder;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\TravelClassSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SeedDemoCommandTest extends TestCase
{
    use RefreshDatabase;

    private const PROMPT = 'Mot de passe commun des comptes de démonstration (12 caractères minimum)';

    private const CONFIRM = 'Confirmer le mot de passe';

    private const STRONG = 'Bertoua2026Demo';

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([CitySeeder::class, TravelClassSeeder::class, RoleSeeder::class]);
    }

    private function confirmQuestion(): string
    {
        return 'Créer les données de démonstration sur '.config('app.url').' ?';
    }

    public function test_demo_data_is_created_with_the_chosen_password(): void
    {
        $this->artisan('routier:seed-demo')
            ->expectsConfirmation($this->confirmQuestion(), 'yes')
            ->expectsQuestion(self::PROMPT, self::STRONG)
            ->expectsQuestion(self::CONFIRM, self::STRONG)
            ->assertSuccessful();

        $this->assertSame(1, Organization::count());
        $this->assertSame(8, User::count());
        $this->assertTrue(Trip::exists());

        foreach (User::all() as $user) {
            $this->assertTrue(Hash::check(self::STRONG, $user->password));
            $this->assertFalse(Hash::check('password', $user->password));
        }
    }

    public function test_weak_or_default_passwords_are_refused(): void
    {
        foreach (['password', 'court1', 'sanschiffreslongs'] as $weak) {
            $this->artisan('routier:seed-demo')
                ->expectsConfirmation($this->confirmQuestion(), 'yes')
                ->expectsQuestion(self::PROMPT, $weak)
                ->assertFailed();
        }

        $this->assertSame(0, User::count());
        $this->assertSame(0, Organization::count());
    }

    public function test_mismatched_confirmation_creates_nothing(): void
    {
        $this->artisan('routier:seed-demo')
            ->expectsConfirmation($this->confirmQuestion(), 'yes')
            ->expectsQuestion(self::PROMPT, self::STRONG)
            ->expectsQuestion(self::CONFIRM, 'Autre2026Demo!')
            ->assertFailed();

        $this->assertSame(0, User::count());
    }

    public function test_declining_the_confirmation_creates_nothing(): void
    {
        $this->artisan('routier:seed-demo')
            ->expectsConfirmation($this->confirmQuestion(), 'no')
            ->assertFailed();

        $this->assertSame(0, User::count());
    }

    public function test_second_run_does_nothing(): void
    {
        $this->artisan('routier:seed-demo')
            ->expectsConfirmation($this->confirmQuestion(), 'yes')
            ->expectsQuestion(self::PROMPT, self::STRONG)
            ->expectsQuestion(self::CONFIRM, self::STRONG)
            ->assertSuccessful();

        $this->artisan('routier:seed-demo')
            ->expectsOutputToContain('déjà présentes')
            ->assertSuccessful();

        $this->assertSame(8, User::count());
    }

    public function test_existing_demo_address_blocks_the_creation(): void
    {
        User::factory()->create(['email' => 'admin@routier237.test']);

        $this->artisan('routier:seed-demo')->assertFailed();

        $this->assertSame(0, Organization::count());
    }

    public function test_database_seeder_skips_demo_data_outside_local_and_testing(): void
    {
        foreach (['staging', 'production'] as $environment) {
            $this->app['env'] = $environment;

            // Appel direct : db:seed demanderait une confirmation en production.
            $this->app->make(DatabaseSeeder::class)->setContainer($this->app)->__invoke();

            $this->assertSame(0, Organization::count(), "Démo créée en {$environment}.");
        }
    }
}
