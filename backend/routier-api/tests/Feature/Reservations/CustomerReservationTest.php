<?php

namespace Tests\Feature\Reservations;

use App\Actions\Reservations\ChangeReservationStatus;
use App\Enums\ReservationStatus;
use App\Enums\RoleName;
use App\Enums\TripStatus;
use App\Models\Agency;
use App\Models\Passenger;
use App\Models\Reservation;
use App\Models\Trip;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\Concerns\AuthenticatesInSpace;
use Tests\Concerns\CreatesUsers;
use Tests\TestCase;

/**
 * Parcours B – Réservation (§5.2) : critères A5, A6, A7, A9.
 */
class CustomerReservationTest extends TestCase
{
    use AuthenticatesInSpace, CreatesUsers, RefreshDatabase;

    private User $customer;

    private Trip $trip;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRoles();
        $this->customer = $this->customer();
        $this->trip = $this->tripWithCapacity(30);
    }

    private function tripWithCapacity(int $capacity, array $attributes = []): Trip
    {
        $agency = Agency::factory()->create();
        $vehicle = Vehicle::factory()->for($agency)->create(['capacity' => $capacity]);

        return Trip::factory()->for($agency)->for($vehicle)->create(array_merge([
            'travel_class_id' => $vehicle->travel_class_id,
            'departure_date' => now()->addDays(2)->toDateString(),
            'departure_time' => '08:00:00',
            'price' => 7000,
            'status' => TripStatus::Published,
        ], $attributes));
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function passengers(int $adults = 1, int $children = 0): array
    {
        return [
            ...array_fill(0, $adults, ['full_name' => 'Awa Nkoulou', 'phone' => '699 11 22 33', 'passenger_type' => 'adult']),
            ...array_fill(0, $children, ['full_name' => 'Petit Nkoulou', 'birth_date' => '2019-04-12', 'passenger_type' => 'child']),
        ];
    }

    private function book(array $passengers, ?Trip $trip = null): TestResponse
    {
        return $this->asCustomer($this->customer)->postJson('/api/v1/account/reservations', [
            'trip_id' => ($trip ?? $this->trip)->id,
            'passengers' => $passengers,
        ]);
    }

    public function test_a_customer_books_several_passengers_including_children(): void
    {
        $this->travelTo(now()->startOfMinute());

        $response = $this->book($this->passengers(adults: 1, children: 2))
            ->assertCreated()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.passenger_count', 3)
            ->assertJsonPath('data.total_amount', 21000)
            ->assertJsonPath('data.currency', 'XAF')
            ->assertJsonPath('data.trip.id', $this->trip->id)
            ->assertJsonPath('data.trip.unit_price', 7000)
            ->assertJsonCount(3, 'data.passengers')
            ->assertJsonPath('data.passengers.0.phone', '699112233')
            ->assertJsonPath('data.passengers.1.passenger_type', 'child')
            ->assertJsonPath('data.passengers.1.phone', null)
            ->assertJsonPath('data.expires_at', now()->addMinutes(15)->toJSON());

        $this->assertMatchesRegularExpression('/^R237-[A-HJ-NP-Z2-9]{8}$/', $response->json('data.reference'));

        $reservation = Reservation::firstOrFail();
        $this->assertSame($this->customer->id, $reservation->user_id);
        $this->assertSame(3, $reservation->passengers()->count());
        // Aucun siège numéroté (critère A7) : seules les places restantes diminuent.
        $this->assertSame(27, $this->trip->fresh()->remainingSeats());
    }

    public function test_reservation_payload_is_validated(): void
    {
        $this->book([])->assertUnprocessable()->assertJsonValidationErrors('passengers');

        $this->book(array_fill(0, 21, ['full_name' => 'X Y', 'passenger_type' => 'adult']))
            ->assertUnprocessable()->assertJsonValidationErrors('passengers');

        $this->book([
            ['full_name' => '', 'passenger_type' => 'senior', 'birth_date' => now()->addDay()->toDateString(), 'phone' => '123'],
        ])->assertUnprocessable()->assertJsonValidationErrors([
            'passengers.0.full_name', 'passengers.0.passenger_type', 'passengers.0.birth_date', 'passengers.0.phone',
        ]);

        $this->asCustomer($this->customer)->postJson('/api/v1/account/reservations', [
            'trip_id' => 999999, 'passengers' => $this->passengers(),
        ])->assertUnprocessable()->assertJsonValidationErrors('trip_id');

        $this->assertSame(0, Reservation::count());
    }

    public function test_capacity_is_enforced(): void
    {
        $small = $this->tripWithCapacity(4);
        Reservation::factory()->for($small)->create(['passenger_count' => 2]);

        $this->book($this->passengers(adults: 3), $small)
            ->assertStatus(409)
            ->assertJsonPath('message', 'Places insuffisantes : il reste 2 place(s) sur ce trajet.');

        $this->assertSame(1, Reservation::count());
        $this->assertSame(0, Passenger::count());

        $this->book($this->passengers(adults: 2), $small)->assertCreated();
        $this->book($this->passengers(), $small)->assertStatus(409);
    }

    public function test_expired_holds_release_their_seats(): void
    {
        $small = $this->tripWithCapacity(2);
        $hold = Reservation::factory()->for($small)->pending()->create(['passenger_count' => 2]);

        $this->book($this->passengers(), $small)->assertStatus(409);

        $this->travelTo(now()->addMinutes(16));
        $this->book($this->passengers(), $small)->assertCreated();

        $this->artisan('reservations:expire')->assertSuccessful();
        $this->assertSame(ReservationStatus::Expired, $hold->fresh()->status);
    }

    public function test_only_bookable_trips_accept_reservations(): void
    {
        foreach ([TripStatus::Draft, TripStatus::Cancelled] as $status) {
            $this->book($this->passengers(), $this->tripWithCapacity(30, ['status' => $status]))->assertStatus(409);
        }

        $this->travelTo($this->trip->departsAt()->addMinute());
        $this->book($this->passengers())->assertStatus(409);

        $this->assertSame(0, Reservation::count());
    }

    public function test_only_customers_can_book(): void
    {
        $this->postJson('/api/v1/account/reservations', ['trip_id' => $this->trip->id, 'passengers' => $this->passengers()])
            ->assertUnauthorized();

        $manager = $this->staff(RoleName::AgencyManager, $this->trip->agency);
        $this->asAgency($manager)->postJson('/api/v1/account/reservations', [
            'trip_id' => $this->trip->id, 'passengers' => $this->passengers(),
        ])->assertForbidden();
    }

    public function test_a_customer_only_sees_their_own_reservations(): void
    {
        $own = Reservation::factory()->for($this->trip)->for($this->customer)->create();
        Passenger::factory()->for($own)->create();
        $foreign = Reservation::factory()->for($this->trip)->for($this->customer())->create();

        $this->asCustomer($this->customer)->getJson('/api/v1/account/reservations')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.reference', $own->reference);

        $this->asCustomer($this->customer)->getJson("/api/v1/account/reservations/{$own->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data.passengers');

        $this->asCustomer($this->customer)->getJson("/api/v1/account/reservations/{$foreign->id}")->assertForbidden();
        $this->asCustomer($this->customer)->postJson("/api/v1/account/reservations/{$foreign->id}/cancel")->assertForbidden();
        $this->assertSame(ReservationStatus::Confirmed, $foreign->fresh()->status);
    }

    public function test_a_customer_cancels_before_departure_only(): void
    {
        $reservation = Reservation::factory()->for($this->trip)->for($this->customer)->pending()->create();

        $this->asCustomer($this->customer)->postJson("/api/v1/account/reservations/{$reservation->id}/cancel")
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled');
        $this->assertNotNull($reservation->fresh()->cancelled_at);

        $this->asCustomer($this->customer)->postJson("/api/v1/account/reservations/{$reservation->id}/cancel")
            ->assertStatus(409);

        $confirmed = Reservation::factory()->for($this->trip)->for($this->customer)->create();
        $this->travelTo($this->trip->departsAt()->addHour());
        $this->asCustomer($this->customer)->postJson("/api/v1/account/reservations/{$confirmed->id}/cancel")
            ->assertStatus(409);
    }

    public function test_reservations_are_not_transferable(): void
    {
        $reservation = Reservation::factory()->for($this->trip)->for($this->customer)->create();

        // Aucun point d'entrée ne permet de changer le titulaire ou les passagers.
        $this->asCustomer($this->customer)->patchJson("/api/v1/account/reservations/{$reservation->id}", [
            'user_id' => $this->customer()->id,
        ])->assertStatus(405);

        $this->assertSame($this->customer->id, $reservation->fresh()->user_id);
    }

    public function test_reservation_state_machine(): void
    {
        $changeStatus = app(ChangeReservationStatus::class);
        $pending = Reservation::factory()->for($this->trip)->pending()->create();

        $confirmed = $changeStatus->confirm($pending);
        $this->assertSame(ReservationStatus::Confirmed, $confirmed->status);
        $this->assertNotNull($confirmed->confirmed_at);
        $this->assertNull($confirmed->expires_at);

        $this->assertConflict(fn () => $changeStatus->confirm($confirmed));
        $this->assertConflict(fn () => $changeStatus->expire($confirmed));

        $late = Reservation::factory()->for($this->trip)->pending()->create(['expires_at' => now()->subMinute()]);
        $this->assertConflict(fn () => $changeStatus->confirm($late));
        $this->assertSame(ReservationStatus::Expired, $changeStatus->expire($late)->status);
        $this->assertConflict(fn () => $changeStatus->cancel($late, byCustomer: true));

        $fresh = Reservation::factory()->for($this->trip)->pending()->create();
        $this->assertConflict(fn () => $changeStatus->expire($fresh));
    }

    public function test_reservation_creation_is_rate_limited(): void
    {
        foreach (range(1, 10) as $attempt) {
            $this->book($this->passengers())->assertCreated();
        }

        $this->book($this->passengers())->assertTooManyRequests();
    }

    private function assertConflict(callable $callback): void
    {
        try {
            $callback();
            $this->fail('Une transition interdite a été acceptée.');
        } catch (HttpException $exception) {
            $this->assertSame(409, $exception->getStatusCode());
        }
    }
}
