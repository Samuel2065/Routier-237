<?php

namespace Tests\Feature\Reservations;

use App\Enums\ReservationStatus;
use App\Enums\RoleName;
use App\Enums\TripStatus;
use App\Models\Agency;
use App\Models\Organization;
use App\Models\Passenger;
use App\Models\Reservation;
use App\Models\Trip;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\AuthenticatesInSpace;
use Tests\Concerns\CreatesUsers;
use Tests\TestCase;

/**
 * Réservations côté agence : consultation et annulation dans le périmètre (critère A10).
 */
class AgencyReservationTest extends TestCase
{
    use AuthenticatesInSpace, CreatesUsers, RefreshDatabase;

    private Agency $agency;

    private Trip $trip;

    private Trip $foreignTrip;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRoles();
        $this->agency = Agency::factory()->for(Organization::factory())->create();
        $this->trip = Trip::factory()->for($this->agency)->create();
        $this->foreignTrip = Trip::factory()->create();
    }

    public function test_staff_list_reservations_of_their_agency_only(): void
    {
        $own = Reservation::factory()->for($this->trip)->create(['reference' => 'R237-AAAA2222']);
        Passenger::factory()->for($own)->count(2)->create();
        $pending = Reservation::factory()->for($this->trip)->pending()->create(['reference' => 'R237-BBBB3333']);
        $foreign = Reservation::factory()->for($this->foreignTrip)->create();

        $clerk = $this->staff(RoleName::CounterClerk, $this->agency);

        $this->asAgency($clerk)->getJson('/api/v1/agency/reservations')
            ->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('data.0.customer.id', $pending->user_id);

        $this->asAgency($clerk)->getJson('/api/v1/agency/reservations?status=pending')->assertJsonCount(1, 'data');
        $this->asAgency($clerk)->getJson('/api/v1/agency/reservations?search=aaaa')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $own->id);
        $this->asAgency($clerk)->getJson("/api/v1/agency/reservations?trip_id={$this->trip->id}&date={$this->trip->departure_date->toDateString()}")
            ->assertJsonPath('meta.total', 2);

        $this->asAgency($clerk)->getJson("/api/v1/agency/reservations/{$own->id}")
            ->assertOk()
            ->assertJsonCount(2, 'data.passengers')
            ->assertJsonPath('data.customer.email', $own->user->email);

        $this->asAgency($clerk)->getJson("/api/v1/agency/reservations/{$foreign->id}")->assertForbidden();
    }

    public function test_authorized_staff_cancel_reservations(): void
    {
        $reservation = Reservation::factory()->for($this->trip)->create();
        $foreign = Reservation::factory()->for($this->foreignTrip)->create();
        $clerk = $this->staff(RoleName::CounterClerk, $this->agency);

        $this->asAgency($clerk)->postJson("/api/v1/agency/reservations/{$foreign->id}/cancel")->assertForbidden();
        $this->assertSame(ReservationStatus::Confirmed, $foreign->fresh()->status);

        $this->asAgency($clerk)->postJson("/api/v1/agency/reservations/{$reservation->id}/cancel")
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled');

        // Un trajet terminé fait partie de l'historique.
        $completed = Trip::factory()->for($this->agency)->create(['status' => TripStatus::Completed]);
        $past = Reservation::factory()->for($completed)->create();
        $this->asAgency($clerk)->postJson("/api/v1/agency/reservations/{$past->id}/cancel")->assertStatus(409);
    }

    public function test_roles_without_reservation_permissions_are_refused(): void
    {
        $reservation = Reservation::factory()->for($this->trip)->create();

        $driver = $this->staff(RoleName::Driver, $this->agency);
        $this->asAgency($driver)->getJson('/api/v1/agency/reservations')->assertForbidden();
        $this->asAgency($driver)->getJson("/api/v1/agency/reservations/{$reservation->id}")->assertForbidden();

        // Le comptable consulte mais n'annule pas.
        $accountant = $this->staff(RoleName::Accountant, $this->agency);
        $this->asAgency($accountant)->getJson('/api/v1/agency/reservations')->assertOk();
        $this->asAgency($accountant)->postJson("/api/v1/agency/reservations/{$reservation->id}/cancel")->assertForbidden();

        // Un client ne passe pas par l'espace agence.
        $this->asCustomer($reservation->user->assignRole(RoleName::Customer->value))
            ->getJson('/api/v1/agency/reservations')
            ->assertForbidden();
    }
}
