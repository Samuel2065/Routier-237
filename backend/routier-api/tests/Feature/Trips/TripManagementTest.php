<?php

namespace Tests\Feature\Trips;

use App\Enums\RecordStatus;
use App\Enums\ReservationStatus;
use App\Enums\RoleName;
use App\Enums\TripStatus;
use App\Enums\VehicleStatus;
use App\Models\Agency;
use App\Models\Organization;
use App\Models\Reservation;
use App\Models\TravelClass;
use App\Models\TravelRoute;
use App\Models\Trip;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\AuthenticatesInSpace;
use Tests\Concerns\CreatesUsers;
use Tests\TestCase;

class TripManagementTest extends TestCase
{
    use AuthenticatesInSpace, CreatesUsers, RefreshDatabase;

    private Agency $agency;

    private Agency $foreign;

    private TravelRoute $route;

    private Vehicle $vip;

    private Vehicle $classique;

    private User $manager;

    private string $date;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRoles();

        $this->agency = Agency::factory()->for(Organization::factory())->create();
        $this->foreign = Agency::factory()->create();
        $this->route = TravelRoute::factory()->create(['estimated_duration_minutes' => 330]);

        $vipClass = TravelClass::factory()->create(['code' => 'vip']);
        $classiqueClass = TravelClass::factory()->create(['code' => 'classique']);
        $this->vip = Vehicle::factory()->for($this->agency)->for($vipClass)->create(['capacity' => 30]);
        $this->classique = Vehicle::factory()->for($this->agency)->for($classiqueClass)->create(['capacity' => 70]);

        $this->manager = $this->staff(RoleName::AgencyManager, $this->agency);
        $this->date = now()->addDays(3)->toDateString();
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'route_id' => $this->route->id,
            'vehicle_id' => $this->vip->id,
            'departure_date' => $this->date,
            'departure_time' => '06:00',
            'price' => 7000,
        ], $overrides);
    }

    private function createTrip(array $overrides = []): Trip
    {
        return Trip::factory()->for($this->agency)->for($this->vip)->create(array_merge([
            'route_id' => $this->route->id,
            'travel_class_id' => $this->vip->travel_class_id,
            'departure_date' => $this->date,
            'departure_time' => '06:00:00',
            'status' => TripStatus::Draft,
        ], $overrides));
    }

    public function test_a_trip_takes_its_class_and_capacity_from_the_vehicle(): void
    {
        $this->asAgency($this->manager)->postJson('/api/v1/agency/trips', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.agency.id', $this->agency->id)
            ->assertJsonPath('data.travel_class.id', $this->vip->travel_class_id)
            ->assertJsonPath('data.departure_time', '06:00')
            ->assertJsonPath('data.capacity', 30)
            ->assertJsonPath('data.reserved_seats', 0)
            ->assertJsonPath('data.remaining_seats', 30)
            ->assertJsonPath('data.price', 7000);

        // La classe ne se saisit pas.
        $this->asAgency($this->manager)->postJson('/api/v1/agency/trips', $this->payload([
            'departure_time' => '18:00', 'travel_class_id' => $this->classique->travel_class_id,
        ]))->assertUnprocessable()->assertJsonValidationErrors('travel_class_id');
    }

    public function test_trip_creation_is_validated(): void
    {
        $foreignVehicle = Vehicle::factory()->for($this->foreign)->create();
        $inactiveRoute = TravelRoute::factory()->create(['status' => RecordStatus::Inactive]);
        $this->classique->update(['status' => VehicleStatus::Maintenance]);

        $this->asAgency($this->manager)->postJson('/api/v1/agency/trips', $this->payload(['vehicle_id' => $foreignVehicle->id]))
            ->assertUnprocessable()->assertJsonValidationErrors('vehicle_id');
        $this->asAgency($this->manager)->postJson('/api/v1/agency/trips', $this->payload(['vehicle_id' => $this->classique->id]))
            ->assertUnprocessable()->assertJsonValidationErrors('vehicle_id');
        $this->asAgency($this->manager)->postJson('/api/v1/agency/trips', $this->payload(['route_id' => $inactiveRoute->id]))
            ->assertUnprocessable()->assertJsonValidationErrors('route_id');
        $this->asAgency($this->manager)->postJson('/api/v1/agency/trips', $this->payload([
            'departure_date' => now()->subDay()->toDateString(), 'price' => 0, 'departure_time' => '6h',
        ]))->assertUnprocessable()->assertJsonValidationErrors(['departure_date', 'price', 'departure_time']);

        // Aujourd'hui mais heure déjà passée.
        $this->travelTo(now()->setTime(12, 0));
        $this->asAgency($this->manager)->postJson('/api/v1/agency/trips', $this->payload([
            'departure_date' => today()->toDateString(), 'departure_time' => '08:00',
        ]))->assertUnprocessable()->assertJsonValidationErrors('departure_time');
    }

    public function test_a_vehicle_cannot_be_on_two_overlapping_trips(): void
    {
        $this->asAgency($this->manager)->postJson('/api/v1/agency/trips', $this->payload())->assertCreated();

        // 06:00 + 330 min = 11:30 : départ à 10:00 impossible, à 12:00 possible.
        $this->asAgency($this->manager)->postJson('/api/v1/agency/trips', $this->payload(['departure_time' => '10:00']))
            ->assertUnprocessable()->assertJsonValidationErrors('vehicle_id');
        $this->asAgency($this->manager)->postJson('/api/v1/agency/trips', $this->payload(['departure_time' => '12:00']))
            ->assertCreated();

        // Un autre véhicule peut partir à la même heure ; un trajet annulé libère le véhicule.
        $this->asAgency($this->manager)->postJson('/api/v1/agency/trips', $this->payload(['vehicle_id' => $this->classique->id]))
            ->assertCreated();
        $cancelled = $this->createTrip(['departure_date' => now()->addDays(5)->toDateString(), 'status' => TripStatus::Cancelled]);
        $this->asAgency($this->manager)->postJson('/api/v1/agency/trips', $this->payload(['departure_date' => $cancelled->departure_date->toDateString()]))
            ->assertCreated();
    }

    public function test_publication_workflow_and_state_machine(): void
    {
        $trip = $this->createTrip();

        $this->asAgency($this->manager)->postJson("/api/v1/agency/trips/{$trip->id}/complete")->assertStatus(409);
        $this->asAgency($this->manager)->postJson("/api/v1/agency/trips/{$trip->id}/publish")
            ->assertOk()->assertJsonPath('data.status', 'published');
        $this->asAgency($this->manager)->postJson("/api/v1/agency/trips/{$trip->id}/publish")->assertStatus(409);
        $this->asAgency($this->manager)->postJson("/api/v1/agency/trips/{$trip->id}/unpublish")
            ->assertOk()->assertJsonPath('data.status', 'draft');

        // Publication impossible si le véhicule n'est plus en service.
        $this->vip->update(['status' => VehicleStatus::Maintenance]);
        $this->asAgency($this->manager)->postJson("/api/v1/agency/trips/{$trip->id}/publish")
            ->assertStatus(409)
            ->assertJsonPath('message', "Le véhicule n'est pas en service.");
        $this->vip->update(['status' => VehicleStatus::Active]);

        // Terminer un trajet pas encore parti : refus.
        $this->asAgency($this->manager)->postJson("/api/v1/agency/trips/{$trip->id}/publish")->assertOk();
        $this->asAgency($this->manager)->postJson("/api/v1/agency/trips/{$trip->id}/complete")->assertStatus(409);

        $this->travelTo($trip->departsAt()->addHours(8));
        $this->asAgency($this->manager)->postJson("/api/v1/agency/trips/{$trip->id}/complete")
            ->assertOk()->assertJsonPath('data.status', 'completed');
        $this->asAgency($this->manager)->postJson("/api/v1/agency/trips/{$trip->id}/cancel")->assertStatus(409);
        $this->asAgency($this->manager)->patchJson("/api/v1/agency/trips/{$trip->id}", ['price' => 1])->assertStatus(409);
    }

    public function test_trips_can_be_published_at_creation_by_authorized_staff_only(): void
    {
        $this->asAgency($this->manager)->postJson('/api/v1/agency/trips', $this->payload(['status' => 'published']))
            ->assertCreated()->assertJsonPath('data.status', 'published');

        $director = $this->director($this->agency->organization);
        $this->asAgency($director)->postJson('/api/v1/agency/trips', $this->payload([
            'status' => 'published', 'vehicle_id' => $this->classique->id, 'agency_id' => $this->agency->id,
        ]))->assertCreated();

        $driver = $this->staff(RoleName::Driver, $this->agency);
        $this->asAgency($driver)->postJson('/api/v1/agency/trips', $this->payload(['departure_time' => '20:00']))->assertForbidden();
    }

    public function test_remaining_seats_follow_valid_reservations_only(): void
    {
        $trip = $this->createTrip(['status' => TripStatus::Published]);

        Reservation::factory()->for($trip)->create(['passenger_count' => 5]);
        Reservation::factory()->for($trip)->pending()->create(['passenger_count' => 3]);
        Reservation::factory()->for($trip)->pending()->create(['passenger_count' => 4, 'expires_at' => now()->subMinute()]);
        Reservation::factory()->for($trip)->create(['passenger_count' => 2, 'status' => ReservationStatus::Cancelled]);

        $this->assertSame(8, $trip->reservedSeats());
        $this->assertSame(22, $trip->remainingSeats());

        $this->asAgency($this->manager)->getJson("/api/v1/agency/trips/{$trip->id}")
            ->assertOk()
            ->assertJsonPath('data.capacity', 30)
            ->assertJsonPath('data.reserved_seats', 8)
            ->assertJsonPath('data.remaining_seats', 22);
    }

    public function test_reserved_trips_keep_their_route_and_class(): void
    {
        $trip = $this->createTrip(['status' => TripStatus::Published]);
        Reservation::factory()->for($trip)->create(['passenger_count' => 20]);
        $otherRoute = TravelRoute::factory()->create();
        $smallVip = Vehicle::factory()->for($this->agency)->create([
            'travel_class_id' => $this->vip->travel_class_id, 'capacity' => 15,
        ]);

        $this->asAgency($this->manager)->patchJson("/api/v1/agency/trips/{$trip->id}", ['route_id' => $otherRoute->id])
            ->assertUnprocessable()->assertJsonValidationErrors('route_id');
        $this->asAgency($this->manager)->patchJson("/api/v1/agency/trips/{$trip->id}", ['vehicle_id' => $this->classique->id])
            ->assertUnprocessable()->assertJsonValidationErrors('vehicle_id');
        $this->asAgency($this->manager)->patchJson("/api/v1/agency/trips/{$trip->id}", ['vehicle_id' => $smallVip->id])
            ->assertUnprocessable()->assertJsonValidationErrors('vehicle_id');

        // Le prix peut évoluer : le montant des réservations existantes est figé.
        $this->asAgency($this->manager)->patchJson("/api/v1/agency/trips/{$trip->id}", ['price' => 8000])
            ->assertOk()->assertJsonPath('data.price', 8000);

        $this->asAgency($this->manager)->postJson("/api/v1/agency/trips/{$trip->id}/unpublish")->assertStatus(409);
    }

    public function test_cancelling_a_trip_cancels_its_active_reservations(): void
    {
        $trip = $this->createTrip(['status' => TripStatus::Published]);
        $confirmed = Reservation::factory()->for($trip)->create();
        $pending = Reservation::factory()->for($trip)->pending()->create();

        $this->asAgency($this->manager)->postJson("/api/v1/agency/trips/{$trip->id}/cancel")
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled')
            ->assertJsonPath('data.reserved_seats', 0);

        foreach ([$confirmed, $pending] as $reservation) {
            $this->assertSame(ReservationStatus::Cancelled, $reservation->fresh()->status);
            $this->assertNotNull($reservation->fresh()->cancelled_at);
        }
    }

    public function test_only_drafts_without_reservations_can_be_deleted(): void
    {
        $draft = $this->createTrip();
        $published = $this->createTrip(['departure_time' => '18:00:00', 'status' => TripStatus::Published]);

        $this->asAgency($this->manager)->deleteJson("/api/v1/agency/trips/{$published->id}")->assertStatus(409);
        $this->asAgency($this->manager)->deleteJson("/api/v1/agency/trips/{$draft->id}")->assertNoContent();
        $this->assertModelMissing($draft);
    }

    public function test_trips_are_isolated_between_agencies(): void
    {
        $own = $this->createTrip();
        $foreignTrip = Trip::factory()->for($this->foreign)->create();

        $this->asAgency($this->manager)->getJson('/api/v1/agency/trips')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $own->id);
        $this->asAgency($this->manager)->getJson("/api/v1/agency/trips/{$foreignTrip->id}")->assertForbidden();
        $this->asAgency($this->manager)->postJson("/api/v1/agency/trips/{$foreignTrip->id}/cancel")->assertForbidden();
        $this->asAgency($this->manager)->patchJson("/api/v1/agency/trips/{$foreignTrip->id}", ['price' => 1])->assertForbidden();
        $this->assertSame(TripStatus::Published, $foreignTrip->fresh()->status);

        // Le conducteur consulte les trajets de son agence mais ne les gère pas.
        $driver = $this->staff(RoleName::Driver, $this->agency);
        $this->asAgency($driver)->getJson('/api/v1/agency/trips')->assertOk()->assertJsonCount(1, 'data');
        $this->asAgency($driver)->postJson("/api/v1/agency/trips/{$own->id}/publish")->assertForbidden();

        // Filtres par date et statut.
        $this->asAgency($this->manager)->getJson('/api/v1/agency/trips?status=published')->assertJsonCount(0, 'data');
        $this->asAgency($this->manager)->getJson("/api/v1/agency/trips?date_from={$this->date}&date_to={$this->date}")
            ->assertJsonCount(1, 'data');
    }

    public function test_past_published_trips_are_completed_nightly(): void
    {
        $past = $this->createTrip(['departure_date' => now()->subDays(2)->toDateString(), 'status' => TripStatus::Published]);
        $future = $this->createTrip(['status' => TripStatus::Published]);
        $pastDraft = $this->createTrip(['departure_date' => now()->subDays(4)->toDateString()]);

        $this->artisan('trips:complete-past')->assertSuccessful();

        $this->assertSame(TripStatus::Completed, $past->fresh()->status);
        $this->assertSame(TripStatus::Published, $future->fresh()->status);
        $this->assertSame(TripStatus::Draft, $pastDraft->fresh()->status);
    }
}
