<?php

namespace Tests\Feature\Database;

use App\Enums\PassengerType;
use App\Enums\PaymentMethod;
use App\Enums\ReservationStatus;
use App\Enums\TripStatus;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\DriverProfile;
use App\Models\Organization;
use App\Models\Passenger;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Trip;
use App\Models\User;
use Illuminate\Database\Eloquent\MassAssignmentException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ModelRelationsTest extends TestCase
{
    use RefreshDatabase;

    public function test_trip_relations_and_casts(): void
    {
        $trip = Trip::factory()->create();

        $this->assertInstanceOf(Agency::class, $trip->agency);
        $this->assertSame($trip->agency_id, $trip->vehicle->agency_id);
        $this->assertSame($trip->travel_class_id, $trip->vehicle->travel_class_id);
        $this->assertNotNull($trip->route->departureCity);
        $this->assertNotNull($trip->route->destinationCity);
        $this->assertSame(TripStatus::Published, $trip->status);
        $this->assertTrue($trip->agency->trips->contains($trip));
        $this->assertTrue($trip->vehicle->trips->contains($trip));
        $this->assertTrue($trip->route->trips->contains($trip));
    }

    public function test_reservation_holds_several_passengers_including_children_without_account(): void
    {
        $reservation = Reservation::factory()->state(['passenger_count' => 3])->create();
        Passenger::factory()->for($reservation)->create();
        Passenger::factory()->for($reservation)->child()->count(2)->create();

        $reservation->refresh();

        $this->assertSame(3, $reservation->passengers()->count());
        $this->assertSame($reservation->passenger_count, $reservation->passengers()->count());
        $this->assertSame(2, $reservation->passengers->where('passenger_type', PassengerType::Child)->count());
        $this->assertSame($reservation->trip->price * 3, $reservation->total_amount);
        $this->assertInstanceOf(User::class, $reservation->user);
        $this->assertTrue($reservation->user->reservations->contains($reservation));
    }

    public function test_reservation_can_have_several_payments(): void
    {
        $reservation = Reservation::factory()->pending()->create();
        Payment::factory()->for($reservation)->count(2)->create();

        $this->assertSame(ReservationStatus::Pending, $reservation->status);
        $this->assertCount(2, $reservation->payments);
        $this->assertInstanceOf(PaymentMethod::class, $reservation->payments->first()->method);
        $this->assertSame($reservation->total_amount, $reservation->payments->first()->amount);
    }

    public function test_driver_profile_extends_an_employee_profile(): void
    {
        $driver = DriverProfile::factory()->create();

        $employee = $driver->employeeProfile;

        $this->assertTrue($employee->driverProfile->is($driver));
        $this->assertTrue($employee->agency->employeeProfiles->contains($employee));
        $this->assertTrue($employee->user->employeeProfile->is($employee));
    }

    public function test_sensitive_attributes_are_not_mass_assignable(): void
    {
        $user = new User([
            'name' => 'X',
            'email' => 'x@example.test',
            'password' => 'secret',
            'organization_id' => 1,
            'status' => 'suspended',
        ]);
        $this->assertNull($user->organization_id);
        // « suspended » est ignoré : le statut reste la valeur par défaut.
        $this->assertSame(UserStatus::Active, $user->status);

        $payment = new Payment(['method' => 'card', 'status' => 'paid', 'amount' => 1]);
        $this->assertSame(['method' => 'card'], $payment->getAttributes());

        $trip = new Trip(['agency_id' => 1, 'price' => 5000]);
        $this->assertNull($trip->agency_id);

        // Réservation totalement protégée : toute tentative d'assignation en masse échoue.
        $this->expectException(MassAssignmentException::class);
        new Reservation(['status' => 'confirmed', 'total_amount' => 1, 'user_id' => 1]);
    }

    public function test_commercial_history_cannot_be_deleted_physically(): void
    {
        $reservation = Reservation::factory()->create();

        $this->expectException(QueryException::class);

        // La suppression d'un trajet réservé est bloquée par la contrainte étrangère.
        $reservation->trip->delete();
    }

    public function test_organization_with_agencies_cannot_be_deleted(): void
    {
        $organization = Organization::factory()->has(Agency::factory())->create();

        $this->expectException(QueryException::class);

        $organization->delete();
    }
}
