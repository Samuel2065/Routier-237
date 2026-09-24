<?php

namespace Tests\Feature\Search;

use App\Enums\RecordStatus;
use App\Enums\ReservationStatus;
use App\Enums\TripStatus;
use App\Enums\VehicleStatus;
use App\Models\Agency;
use App\Models\City;
use App\Models\Organization;
use App\Models\Reservation;
use App\Models\TravelClass;
use App\Models\TravelRoute;
use App\Models\Trip;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Recherche publique (§5.1, critères A1, A2, A3) et neutralité (§18.3).
 */
class PublicTripSearchTest extends TestCase
{
    use RefreshDatabase;

    private City $bertoua;

    private City $yaounde;

    private TravelRoute $route;

    private Agency $agency;

    private TravelClass $vip;

    private TravelClass $classique;

    private string $date;

    protected function setUp(): void
    {
        parent::setUp();

        $this->bertoua = City::factory()->create(['name' => 'Bertoua', 'slug' => 'bertoua']);
        $this->yaounde = City::factory()->create(['name' => 'Yaoundé', 'slug' => 'yaounde']);
        $this->route = TravelRoute::factory()->create([
            'departure_city_id' => $this->bertoua->id,
            'destination_city_id' => $this->yaounde->id,
            'estimated_duration_minutes' => 330,
        ]);
        $this->agency = Agency::factory()->create(['name' => 'Agence Bertoua Centre']);
        $this->vip = TravelClass::factory()->create(['code' => 'vip', 'name' => 'VIP']);
        $this->classique = TravelClass::factory()->create(['code' => 'classique', 'name' => 'Classique']);
        $this->date = now()->addDays(2)->toDateString();
    }

    private function trip(array $attributes = [], ?Agency $agency = null, ?TravelClass $class = null, int $capacity = 30): Trip
    {
        $agency ??= $this->agency;
        $vehicle = Vehicle::factory()->for($agency)->for($class ?? $this->vip)->create(['capacity' => $capacity]);

        return Trip::factory()->for($agency)->for($vehicle)->create(array_merge([
            'route_id' => $this->route->id,
            'travel_class_id' => $vehicle->travel_class_id,
            'departure_date' => $this->date,
            'departure_time' => '06:00:00',
            'price' => 7000,
            'status' => TripStatus::Published,
        ], $attributes));
    }

    private function search(array $params = []): TestResponse
    {
        return $this->getJson('/api/v1/trips/search?'.http_build_query(array_merge([
            'departure_city_id' => $this->bertoua->id,
            'destination_city_id' => $this->yaounde->id,
            'date' => $this->date,
        ], $params)));
    }

    public function test_a_visitor_searches_without_an_account(): void
    {
        $trip = $this->trip();
        Reservation::factory()->for($trip)->create(['passenger_count' => 4]);

        $this->search()
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $trip->id)
            ->assertJsonPath('data.0.agency.name', 'Agence Bertoua Centre')
            ->assertJsonPath('data.0.departure_city.slug', 'bertoua')
            ->assertJsonPath('data.0.destination_city.slug', 'yaounde')
            ->assertJsonPath('data.0.departure_date', $this->date)
            ->assertJsonPath('data.0.departure_time', '06:00')
            ->assertJsonPath('data.0.travel_class.name', 'VIP')
            ->assertJsonPath('data.0.price', 7000)
            ->assertJsonPath('data.0.remaining_seats', 26)
            ->assertJsonPath('data.0.estimated_duration_minutes', 330)
            ->assertJsonPath('meta.count', 1)
            ->assertJsonPath('meta.departure_city.name', 'Bertoua')
            // Aucune donnée interne ni classement subjectif.
            ->assertJsonMissingPath('data.0.status')
            ->assertJsonMissingPath('data.0.vehicle')
            ->assertJsonMissingPath('data.0.score')
            ->assertJsonMissingPath('data.0.reserved_seats');
    }

    public function test_only_published_and_available_trips_are_returned(): void
    {
        $visible = $this->trip();

        // Statuts non publics.
        $this->trip(['status' => TripStatus::Draft]);
        $this->trip(['status' => TripStatus::Cancelled]);
        // Autre date, autre sens.
        $this->trip(['departure_date' => now()->addDays(3)->toDateString()]);
        $this->trip(['route_id' => TravelRoute::factory()->create([
            'departure_city_id' => $this->yaounde->id, 'destination_city_id' => $this->bertoua->id,
        ])->id]);
        // Agence inactive, organisation suspendue.
        $this->trip([], Agency::factory()->create(['status' => RecordStatus::Inactive]));
        $this->trip([], Agency::factory()->for(Organization::factory()->create(['status' => RecordStatus::Inactive]))->create());
        // Véhicule hors service.
        $maintenance = $this->trip();
        $maintenance->vehicle->update(['status' => VehicleStatus::Maintenance]);
        // Complet.
        $full = $this->trip([], null, null, 10);
        Reservation::factory()->for($full)->create(['passenger_count' => 10]);

        $this->search()->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $visible->id);

        // Un itinéraire désactivé retire ses trajets de la recherche.
        $this->route->update(['status' => RecordStatus::Inactive]);
        $this->search()->assertJsonCount(0, 'data');
    }

    public function test_capacity_counts_only_valid_reservations(): void
    {
        $trip = $this->trip([], null, null, 10);
        Reservation::factory()->for($trip)->create(['passenger_count' => 6]);
        Reservation::factory()->for($trip)->pending()->create(['passenger_count' => 2]);
        // Ne consomment pas de places :
        Reservation::factory()->for($trip)->pending()->create(['passenger_count' => 5, 'expires_at' => now()->subMinute()]);
        Reservation::factory()->for($trip)->create(['passenger_count' => 5, 'status' => ReservationStatus::Cancelled]);

        $this->search()->assertJsonPath('data.0.remaining_seats', 2);
        $this->search(['passengers' => 2])->assertJsonCount(1, 'data');
        $this->search(['passengers' => 3])->assertJsonCount(0, 'data');
    }

    public function test_trips_already_departed_today_are_excluded(): void
    {
        $this->travelTo(today()->setTime(10, 0));
        $this->date = today()->toDateString();

        $this->trip(['departure_time' => '08:00:00']);
        $later = $this->trip(['departure_time' => '14:00:00']);

        $this->search()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $later->id);
    }

    public function test_results_can_be_filtered_by_class_and_sorted_neutrally(): void
    {
        $early = $this->trip(['departure_time' => '06:00:00', 'price' => 7000]);
        $cheap = $this->trip(['departure_time' => '09:00:00', 'price' => 5000], null, $this->classique, 70);
        $late = $this->trip(['departure_time' => '18:00:00', 'price' => 6000], Agency::factory()->create());

        // Par défaut : heure de départ.
        $this->search()->assertJsonPath('data.*.id', [$early->id, $cheap->id, $late->id]);
        // Par prix.
        $this->search(['sort' => 'price'])->assertJsonPath('data.*.id', [$cheap->id, $late->id, $early->id]);
        // Par classe.
        $this->search(['travel_class_id' => $this->classique->id])->assertJsonPath('data.*.id', [$cheap->id]);
    }

    public function test_search_parameters_are_validated(): void
    {
        $this->getJson('/api/v1/trips/search')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['departure_city_id', 'destination_city_id', 'date']);

        $this->search(['destination_city_id' => $this->bertoua->id, 'date' => now()->subDay()->toDateString(), 'passengers' => 0, 'sort' => 'best'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['destination_city_id', 'date', 'passengers', 'sort']);
    }

    public function test_public_trip_detail(): void
    {
        $trip = $this->trip();
        $trip->vehicle->update(['brand' => 'Toyota', 'model' => 'Coaster', 'amenities' => ['climatisation']]);

        $this->getJson("/api/v1/trips/{$trip->id}")
            ->assertOk()
            ->assertJsonPath('data.bookable', true)
            ->assertJsonPath('data.vehicle.model', 'Coaster')
            ->assertJsonPath('data.vehicle.amenities', ['climatisation'])
            ->assertJsonPath('data.remaining_seats', 30)
            ->assertJsonMissingPath('data.vehicle.registration_number');

        // Complet : visible mais non réservable.
        Reservation::factory()->for($trip)->create(['passenger_count' => 30]);
        $this->getJson("/api/v1/trips/{$trip->id}")->assertOk()->assertJsonPath('data.bookable', false);

        // Brouillon, annulé, agence inactive, inexistant : 404.
        $this->getJson('/api/v1/trips/'.$this->trip(['status' => TripStatus::Draft])->id)->assertNotFound();
        $this->getJson('/api/v1/trips/'.$this->trip(['status' => TripStatus::Cancelled])->id)->assertNotFound();
        $this->getJson('/api/v1/trips/'.$this->trip([], Agency::factory()->create(['status' => RecordStatus::Inactive]))->id)->assertNotFound();
        $this->getJson('/api/v1/trips/999999')->assertNotFound();
    }

    public function test_agency_page_lists_its_upcoming_published_trips(): void
    {
        $first = $this->trip(['departure_date' => now()->addDay()->toDateString()]);
        $second = $this->trip(['departure_date' => now()->addDays(4)->toDateString()]);
        $this->trip(['status' => TripStatus::Draft]);
        $this->trip([], Agency::factory()->create());

        $this->getJson("/api/v1/agencies/{$this->agency->id}/trips")
            ->assertOk()
            ->assertJsonPath('data.*.id', [$first->id, $second->id])
            ->assertJsonPath('meta.total', 2);

        $inactive = Agency::factory()->create(['status' => RecordStatus::Inactive]);
        $this->getJson("/api/v1/agencies/{$inactive->id}/trips")->assertNotFound();
    }

    public function test_search_query_count_does_not_grow_with_results(): void
    {
        $count = function (): int {
            DB::flushQueryLog();
            DB::enableQueryLog();
            $this->search()->assertOk();
            DB::disableQueryLog();

            return count(DB::getQueryLog());
        };

        $this->trip();
        $withOne = $count();

        foreach (['08:00:00', '10:00:00', '12:00:00', '14:00:00', '16:00:00'] as $time) {
            $this->trip(['departure_time' => $time], Agency::factory()->create());
        }
        $withSix = $count();

        $this->assertSame($withOne, $withSix, 'Requêtes N+1 détectées dans la recherche.');
    }

    public function test_public_endpoints_are_rate_limited(): void
    {
        foreach (range(1, 120) as $i) {
            $this->getJson('/api/v1/travel-classes')->assertOk();
        }

        $this->getJson('/api/v1/travel-classes')->assertTooManyRequests();
    }
}
