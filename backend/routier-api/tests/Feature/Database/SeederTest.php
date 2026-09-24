<?php

namespace Tests\Feature\Database;

use App\Enums\RoleName;
use App\Enums\TripStatus;
use App\Models\Agency;
use App\Models\Organization;
use App\Models\TravelClass;
use App\Models\Trip;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class SeederTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(DatabaseSeeder::class);
    }

    public function test_reference_data_is_seeded(): void
    {
        $this->assertEqualsCanonicalizing(
            RoleName::values(),
            Role::pluck('name')->all(),
        );

        $this->assertEqualsCanonicalizing(
            [TravelClass::VIP, TravelClass::CLASSIQUE],
            TravelClass::pluck('code')->all(),
        );

        $this->assertDatabaseHas('cities', ['slug' => 'bertoua']);
        $this->assertDatabaseHas('cities', ['slug' => 'yaounde']);
        $this->assertDatabaseHas('cities', ['slug' => 'douala']);
    }

    public function test_demo_accounts_exist_for_every_role(): void
    {
        foreach (RoleName::cases() as $role) {
            $this->assertTrue(
                User::role($role->value)->exists(),
                "Aucun compte de démonstration pour le rôle {$role->value}.",
            );
        }
    }

    public function test_users_are_scoped_according_to_their_role(): void
    {
        $director = User::where('email', 'directeur@routier237.test')->firstOrFail();
        $manager = User::where('email', 'manager.bertoua@routier237.test')->firstOrFail();
        $driver = User::where('email', 'chauffeur.bertoua@routier237.test')->firstOrFail();
        $customer = User::where('email', 'client@routier237.test')->firstOrFail();
        $admin = User::where('email', 'admin@routier237.test')->firstOrFail();

        $this->assertNotNull($director->organization_id);
        $this->assertNull($director->employeeProfile);

        $this->assertSame('Agence Bertoua Centre', $manager->employeeProfile->agency->name);
        $this->assertNotNull($driver->employeeProfile->driverProfile);

        foreach ([$customer, $admin] as $user) {
            $this->assertNull($user->organization_id);
            $this->assertNull($user->employeeProfile);
        }
    }

    public function test_one_organization_can_own_several_agencies(): void
    {
        $organization = Organization::firstOrFail();

        $this->assertCount(2, $organization->agencies);
    }

    public function test_demo_trips_are_consistent_with_their_vehicle(): void
    {
        $trips = Trip::with('vehicle')->get();

        $this->assertNotEmpty($trips);

        foreach ($trips as $trip) {
            $this->assertSame($trip->agency_id, $trip->vehicle->agency_id);
            $this->assertSame($trip->travel_class_id, $trip->vehicle->travel_class_id);
        }

        foreach ([TripStatus::Published, TripStatus::Draft, TripStatus::Cancelled, TripStatus::Completed] as $status) {
            $this->assertTrue(Trip::where('status', $status)->exists(), "Aucun trajet {$status->value}.");
        }
    }

    public function test_vip_and_classique_use_distinct_vehicles(): void
    {
        // Critère A4 : aucun véhicule n'est partagé entre deux classes.
        $vehiclesPerClass = Trip::query()
            ->selectRaw('vehicle_id, COUNT(DISTINCT travel_class_id) AS classes')
            ->groupBy('vehicle_id')
            ->pluck('classes');

        $this->assertTrue($vehiclesPerClass->every(fn ($count) => (int) $count === 1));
    }

    public function test_no_seat_or_stored_availability_columns_exist(): void
    {
        // Critère A7 et §8 : pas de siège numéroté ni de places restantes saisies.
        $this->assertFalse(Schema::hasTable('seats'));

        foreach (['capacity', 'available_seats', 'available_places', 'seat_number'] as $column) {
            $this->assertFalse(Schema::hasColumn('trips', $column), "Colonne trips.$column inattendue.");
        }

        $this->assertFalse(Schema::hasColumn('passengers', 'seat_number'));
    }

    public function test_seeding_twice_does_not_duplicate_data(): void
    {
        $counts = fn () => [
            Organization::count(), Agency::count(), User::count(), Trip::count(), Role::count(), TravelClass::count(),
        ];

        $before = $counts();

        $this->seed(DatabaseSeeder::class);

        $this->assertSame($before, $counts());
    }
}
