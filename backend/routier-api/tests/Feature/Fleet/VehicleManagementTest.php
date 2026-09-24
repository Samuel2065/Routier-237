<?php

namespace Tests\Feature\Fleet;

use App\Enums\RoleName;
use App\Enums\TripStatus;
use App\Models\Agency;
use App\Models\Organization;
use App\Models\Passenger;
use App\Models\Reservation;
use App\Models\TravelClass;
use App\Models\Trip;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\AuthenticatesInSpace;
use Tests\Concerns\CreatesUsers;
use Tests\TestCase;

class VehicleManagementTest extends TestCase
{
    use AuthenticatesInSpace, CreatesUsers, RefreshDatabase;

    private Agency $agency;

    private Agency $sibling;

    private Agency $foreign;

    private TravelClass $vip;

    private TravelClass $classique;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRoles();

        $organization = Organization::factory()->create();
        $this->agency = Agency::factory()->for($organization)->create();
        $this->sibling = Agency::factory()->for($organization)->create();
        $this->foreign = Agency::factory()->create();

        $this->vip = TravelClass::factory()->create(['code' => 'vip', 'name' => 'VIP']);
        $this->classique = TravelClass::factory()->create(['code' => 'classique', 'name' => 'Classique']);
    }

    public function test_travel_classes_are_public(): void
    {
        $this->getJson('/api/v1/travel-classes')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.code', 'classique');
    }

    public function test_manager_registers_a_vehicle_in_their_own_agency(): void
    {
        $manager = $this->staff(RoleName::AgencyManager, $this->agency);

        $this->asAgency($manager)->postJson('/api/v1/agency/vehicles', [
            'travel_class_id' => $this->vip->id,
            'registration_number' => '  es   214  ab ',
            'brand' => 'Toyota',
            'model' => 'Coaster',
            'capacity' => 30,
            'amenities' => ['climatisation', 'prises USB'],
        ])->assertCreated()
            ->assertJsonPath('data.agency.id', $this->agency->id)
            ->assertJsonPath('data.registration_number', 'ES 214 AB')
            ->assertJsonPath('data.travel_class.code', 'vip')
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.amenities', ['climatisation', 'prises USB']);

        // Immatriculation unique, capacité bornée.
        $this->asAgency($manager)->postJson('/api/v1/agency/vehicles', [
            'travel_class_id' => $this->vip->id,
            'registration_number' => 'ES 214 AB',
            'brand' => 'Toyota',
            'model' => 'Coaster',
            'capacity' => 0,
        ])->assertUnprocessable()->assertJsonValidationErrors(['registration_number', 'capacity']);

        // Autre agence (même organisation ou non) : refus.
        foreach ([$this->sibling, $this->foreign] as $other) {
            $this->asAgency($manager)->postJson('/api/v1/agency/vehicles', [
                'agency_id' => $other->id,
                'travel_class_id' => $this->vip->id,
                'registration_number' => 'CE 000 XX',
                'brand' => 'Toyota',
                'model' => 'Coaster',
                'capacity' => 30,
            ])->assertForbidden();
        }
    }

    public function test_director_must_choose_one_of_their_agencies(): void
    {
        $director = $this->director($this->agency->organization);
        $payload = [
            'travel_class_id' => $this->classique->id,
            'registration_number' => 'CE 552 JK',
            'brand' => 'Yutong',
            'model' => 'ZK6122',
            'capacity' => 70,
        ];

        $this->asAgency($director)->postJson('/api/v1/agency/vehicles', $payload)
            ->assertUnprocessable()->assertJsonValidationErrors('agency_id');

        $this->asAgency($director)->postJson('/api/v1/agency/vehicles', $payload + ['agency_id' => $this->foreign->id])
            ->assertForbidden();

        $this->asAgency($director)->postJson('/api/v1/agency/vehicles', $payload + ['agency_id' => $this->sibling->id])
            ->assertCreated()
            ->assertJsonPath('data.agency.id', $this->sibling->id);
    }

    public function test_vehicle_lists_and_details_are_isolated(): void
    {
        $own = Vehicle::factory()->for($this->agency)->create();
        Vehicle::factory()->for($this->sibling)->create();
        $foreign = Vehicle::factory()->for($this->foreign)->create();

        $manager = $this->staff(RoleName::AgencyManager, $this->agency);
        $this->asAgency($manager)->getJson('/api/v1/agency/vehicles')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $own->id);
        $this->asAgency($manager)->getJson("/api/v1/agency/vehicles/{$foreign->id}")->assertForbidden();
        $this->asAgency($manager)->patchJson("/api/v1/agency/vehicles/{$foreign->id}", ['brand' => 'X'])->assertForbidden();
        $this->asAgency($manager)->deleteJson("/api/v1/agency/vehicles/{$foreign->id}")->assertForbidden();

        $director = $this->director($this->agency->organization);
        $this->asAgency($director)->getJson('/api/v1/agency/vehicles')->assertJsonPath('meta.total', 2);

        // Le conducteur consulte la flotte de son agence sans pouvoir la modifier.
        $driver = $this->staff(RoleName::Driver, $this->agency);
        $this->asAgency($driver)->getJson('/api/v1/agency/vehicles')->assertOk()->assertJsonCount(1, 'data');
        $this->asAgency($driver)->patchJson("/api/v1/agency/vehicles/{$own->id}", ['brand' => 'X'])->assertForbidden();

        $clerk = $this->staff(RoleName::CounterClerk, $this->agency);
        $this->asAgency($clerk)->getJson('/api/v1/agency/vehicles')->assertForbidden();
    }

    public function test_class_cannot_change_while_the_vehicle_has_upcoming_trips(): void
    {
        $vehicle = Vehicle::factory()->for($this->agency)->for($this->vip)->create();
        $manager = $this->staff(RoleName::AgencyManager, $this->agency);

        $this->asAgency($manager)->patchJson("/api/v1/agency/vehicles/{$vehicle->id}", ['travel_class_id' => $this->classique->id])
            ->assertOk();

        Trip::factory()->for($this->agency)->for($vehicle)->create(['travel_class_id' => $this->classique->id]);

        $this->asAgency($manager)->patchJson("/api/v1/agency/vehicles/{$vehicle->id}", ['travel_class_id' => $this->vip->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('travel_class_id');
    }

    public function test_capacity_cannot_drop_below_seats_already_reserved(): void
    {
        $vehicle = Vehicle::factory()->for($this->agency)->create(['capacity' => 30]);
        $trip = Trip::factory()->for($this->agency)->for($vehicle)->create(['travel_class_id' => $vehicle->travel_class_id]);

        // 12 places consommées sur un trajet à venir (réservations confirmées ou en attente valides).
        Reservation::factory()->for($trip)->create(['passenger_count' => 8]);
        Reservation::factory()->for($trip)->pending()->create(['passenger_count' => 4]);
        // Ne consomment pas de capacité : réservation expirée, et trajet passé.
        Reservation::factory()->for($trip)->pending()->create(['passenger_count' => 10, 'expires_at' => now()->subMinute()]);
        $pastTrip = Trip::factory()->for($this->agency)->for($vehicle)->create([
            'travel_class_id' => $vehicle->travel_class_id,
            'departure_date' => now()->subDays(3)->toDateString(),
            'status' => TripStatus::Completed,
        ]);
        Reservation::factory()->for($pastTrip)->create(['passenger_count' => 25]);

        $this->assertSame(12, $vehicle->maxReservedSeatsOnUpcomingTrips());

        $manager = $this->staff(RoleName::AgencyManager, $this->agency);

        $this->asAgency($manager)->patchJson("/api/v1/agency/vehicles/{$vehicle->id}", ['capacity' => 11])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('capacity');

        $this->asAgency($manager)->patchJson("/api/v1/agency/vehicles/{$vehicle->id}", ['capacity' => 12])
            ->assertOk()
            ->assertJsonPath('data.capacity', 12);
    }

    public function test_only_unused_vehicles_can_be_deleted(): void
    {
        $manager = $this->staff(RoleName::AgencyManager, $this->agency);
        $unused = Vehicle::factory()->for($this->agency)->create();
        $used = Vehicle::factory()->for($this->agency)->create();
        $trip = Trip::factory()->for($this->agency)->for($used)->create(['travel_class_id' => $used->travel_class_id]);
        Passenger::factory()->for(Reservation::factory()->for($trip))->create();

        $this->asAgency($manager)->deleteJson("/api/v1/agency/vehicles/{$used->id}")->assertStatus(409);
        $this->asAgency($manager)->patchJson("/api/v1/agency/vehicles/{$used->id}", ['status' => 'retired'])
            ->assertOk()->assertJsonPath('data.status', 'retired');

        $this->asAgency($manager)->deleteJson("/api/v1/agency/vehicles/{$unused->id}")->assertNoContent();
        $this->assertModelMissing($unused);
    }
}
