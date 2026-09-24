<?php

namespace Tests\Feature\Agency;

use App\Enums\PaymentStatus;
use App\Enums\ReservationStatus;
use App\Enums\RoleName;
use App\Enums\TripStatus;
use App\Models\Agency;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Trip;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\AuthenticatesInSpace;
use Tests\Concerns\CreatesUsers;
use Tests\TestCase;

/**
 * Tableau de bord agence : indicateurs limités au périmètre et aux permissions.
 */
class DashboardTest extends TestCase
{
    use AuthenticatesInSpace, CreatesUsers, RefreshDatabase;

    private Agency $agency;

    private Agency $sibling;

    private Agency $foreign;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRoles();
        $organization = Organization::factory()->create();
        $this->agency = Agency::factory()->for($organization)->create();
        $this->sibling = Agency::factory()->for($organization)->create();
        $this->foreign = Agency::factory()->create();

        foreach ([$this->agency, $this->sibling, $this->foreign] as $agency) {
            $vehicle = Vehicle::factory()->for($agency)->create(['capacity' => 30]);
            $trip = Trip::factory()->for($agency)->for($vehicle)->create([
                'travel_class_id' => $vehicle->travel_class_id,
                'departure_date' => now()->addDays(2)->toDateString(),
                'status' => TripStatus::Published,
            ]);
            $reservation = Reservation::factory()->for($trip)->create([
                'passenger_count' => 3,
                'status' => ReservationStatus::Confirmed,
                'confirmed_at' => now(),
            ]);
            Payment::factory()->for($reservation)->create([
                'amount' => 21000, 'status' => PaymentStatus::Paid, 'paid_at' => now(), 'provider' => 'mock',
            ]);
        }
    }

    public function test_manager_sees_figures_of_their_agency_only(): void
    {
        $manager = $this->staff(RoleName::AgencyManager, $this->agency);

        $this->asAgency($manager)->getJson('/api/v1/agency/dashboard')
            ->assertOk()
            ->assertJsonPath('data.trips.published_next_7_days', 1)
            ->assertJsonCount(1, 'data.next_departures')
            ->assertJsonPath('data.next_departures.0.reserved_seats', 3)
            ->assertJsonPath('data.next_departures.0.capacity', 30)
            ->assertJsonPath('data.reservations.confirmed_last_7_days', 1)
            ->assertJsonPath('data.reservations.passengers_upcoming', 3)
            ->assertJsonPath('data.payments.paid_this_month_amount', 21000)
            ->assertJsonPath('data.payments.requires_refund', 0)
            ->assertJsonPath('data.fleet.active', 1);

        $this->asAgency($manager)->getJson("/api/v1/agency/dashboard?agency_id={$this->foreign->id}")->assertForbidden();
    }

    public function test_director_sees_the_whole_organization_or_one_agency(): void
    {
        $director = $this->director($this->agency->organization);

        $this->asAgency($director)->getJson('/api/v1/agency/dashboard')
            ->assertOk()
            ->assertJsonPath('data.agency', null)
            ->assertJsonPath('data.trips.published_next_7_days', 2)
            ->assertJsonPath('data.payments.paid_this_month_amount', 42000);

        $this->asAgency($director)->getJson("/api/v1/agency/dashboard?agency_id={$this->sibling->id}")
            ->assertOk()
            ->assertJsonPath('data.agency.id', $this->sibling->id)
            ->assertJsonPath('data.trips.published_next_7_days', 1)
            ->assertJsonPath('data.payments.paid_this_month_amount', 21000);

        $this->asAgency($director)->getJson("/api/v1/agency/dashboard?agency_id={$this->foreign->id}")->assertForbidden();
    }

    public function test_blocks_follow_permissions(): void
    {
        $driver = $this->staff(RoleName::Driver, $this->agency);

        $this->asAgency($driver)->getJson('/api/v1/agency/dashboard')
            ->assertOk()
            ->assertJsonPath('data.trips.published_next_7_days', 1)
            ->assertJsonPath('data.reservations', null)
            ->assertJsonPath('data.payments', null)
            ->assertJsonPath('data.fleet.active', 1);

        $clerk = $this->staff(RoleName::CounterClerk, $this->agency);
        $this->asAgency($clerk)->getJson('/api/v1/agency/dashboard')
            ->assertJsonPath('data.fleet', null)
            ->assertJsonPath('data.payments.requires_refund', 0);
    }

    public function test_me_exposes_assignable_roles(): void
    {
        $manager = $this->staff(RoleName::AgencyManager, $this->agency);

        $this->asAgency($manager)->getJson('/api/v1/auth/me')
            ->assertJsonPath('data.assignable_roles', ['counter_clerk', 'accountant', 'driver']);
    }
}
