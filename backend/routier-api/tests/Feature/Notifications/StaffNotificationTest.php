<?php

namespace Tests\Feature\Notifications;

use App\Enums\PaymentStatus;
use App\Enums\ReservationStatus;
use App\Enums\RoleName;
use App\Enums\TripStatus;
use App\Models\Agency;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Trip;
use App\Models\User;
use App\Models\Vehicle;
use App\Notifications\StaffReservationAlert;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\AuthenticatesInSpace;
use Tests\Concerns\CreatesUsers;
use Tests\TestCase;

/**
 * Phase 3 : alertes du personnel (bons destinataires uniquement) et centre de notifications
 * persistant (lu, tout lu, suppression) dans les espaces client et agence.
 */
class StaffNotificationTest extends TestCase
{
    use AuthenticatesInSpace, CreatesUsers, RefreshDatabase;

    private Agency $agency;

    private Trip $trip;

    private User $customer;

    /** @var array<string, User> */
    private array $staff;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRoles();
        config(['payments.driver' => 'mock']);

        $this->agency = Agency::factory()->create();
        $vehicle = Vehicle::factory()->for($this->agency)->create(['capacity' => 30]);
        $this->trip = Trip::factory()->for($this->agency)->for($vehicle)->create([
            'travel_class_id' => $vehicle->travel_class_id,
            'departure_date' => now()->addDays(2)->toDateString(),
            'status' => TripStatus::Published,
        ]);
        $this->customer = $this->customer();

        $otherAgencyOfSameOrganization = Agency::factory()->for($this->agency->organization)->create();

        $this->staff = [
            'manager' => $this->staff(RoleName::AgencyManager, $this->agency),
            'clerk' => $this->staff(RoleName::CounterClerk, $this->agency),
            'accountant' => $this->staff(RoleName::Accountant, $this->agency),
            'driver' => $this->staff(RoleName::Driver, $this->agency),
            'director' => $this->director($this->agency->organization),
            'other_agency' => $this->staff(RoleName::AgencyManager, $otherAgencyOfSameOrganization),
            'other_organization' => $this->staff(RoleName::AgencyManager, Agency::factory()->create()),
        ];
    }

    public function test_a_confirmed_reservation_alerts_the_agency_staff_allowed_to_see_reservations(): void
    {
        $reservation = $this->pendingReservation();
        $this->pay($reservation);

        $this->assertAlerted(['manager', 'clerk', 'accountant', 'director'], StaffReservationAlert::CONFIRMED);
        $this->assertSame('reservation_confirmed', $this->customer->notifications()->firstOrFail()->data['type']);

        $this->asAgency($this->staff['clerk'])->getJson('/api/v1/agency/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 1)
            ->assertJsonPath('data.0.type', StaffReservationAlert::CONFIRMED)
            ->assertJsonPath('data.0.data.reservation_id', $reservation->id)
            ->assertJsonPath('data.0.data.reference', $reservation->reference);
    }

    public function test_a_customer_cancellation_alerts_the_staff_and_flags_the_refund(): void
    {
        $reservation = $this->pendingReservation();
        $this->pay($reservation);
        $this->clearNotifications();

        $this->asCustomer($this->customer)->postJson("/api/v1/account/reservations/{$reservation->id}/cancel")->assertOk();

        $this->assertAlerted(['manager', 'clerk', 'accountant', 'director'], StaffReservationAlert::CANCELLED_BY_CUSTOMER);
        $message = $this->staff['manager']->notifications()->firstOrFail()->data['message'];
        $this->assertStringContainsString($reservation->reference, $message);
        $this->assertStringContainsString('Paiement à rembourser.', $message);
    }

    public function test_a_late_payment_alerts_only_the_staff_who_can_refund(): void
    {
        $reservation = $this->pendingReservation();
        $reservation->forceFill(['expires_at' => now()->subMinute()])->save();

        $this->pay($reservation);

        $this->assertSame(ReservationStatus::Pending, $reservation->fresh()->status);
        $this->assertAlerted(['accountant'], StaffReservationAlert::REFUND_REQUIRED);
    }

    public function test_the_notification_center_persists_read_and_deleted_states(): void
    {
        $this->pay($this->pendingReservation());
        $this->pay($this->pendingReservation());
        $manager = $this->staff['manager'];
        [$first, $second] = $manager->notifications()->pluck('id')->all();

        $this->asAgency($manager)->postJson("/api/v1/agency/notifications/{$first}/read")->assertNoContent();
        $this->asAgency($manager)->getJson('/api/v1/agency/notifications')->assertJsonPath('unread_count', 1);

        $this->asAgency($manager)->deleteJson("/api/v1/agency/notifications/{$second}")->assertNoContent();
        $this->asAgency($manager)->getJson('/api/v1/agency/notifications')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $first)
            ->assertJsonPath('unread_count', 0);

        // Personne ne lit ni ne supprime la notification d'un autre compte.
        $this->asAgency($this->staff['clerk'])->deleteJson("/api/v1/agency/notifications/{$first}")->assertNotFound();
        $this->asAgency($this->staff['clerk'])->postJson("/api/v1/agency/notifications/{$first}/read")->assertNotFound();
        $this->asCustomer($this->customer)->deleteJson("/api/v1/account/notifications/{$first}")->assertNotFound();
        $this->assertSame(1, $manager->notifications()->count());

        // Le client gère aussi son propre centre.
        $own = $this->customer->notifications()->value('id');
        $this->asCustomer($this->customer)->deleteJson("/api/v1/account/notifications/{$own}")->assertNoContent();
        $this->asCustomer($this->customer)->postJson('/api/v1/account/notifications/read-all')->assertNoContent();
        $this->asCustomer($this->customer)->getJson('/api/v1/account/notifications')->assertJsonPath('unread_count', 0);
    }

    private function pendingReservation(): Reservation
    {
        return Reservation::factory()->for($this->trip)->for($this->customer)->pending()->create();
    }

    private function pay(Reservation $reservation): void
    {
        $payment = Payment::factory()->for($reservation)->create([
            'amount' => $reservation->total_amount, 'status' => PaymentStatus::Processing,
            'provider' => 'mock', 'transaction_reference' => 'MOCK-'.$reservation->id,
        ]);

        $this->asCustomer($this->customer)->postJson("/api/v1/account/payments/{$payment->id}/simulate", ['outcome' => 'paid'])->assertOk();
    }

    private function clearNotifications(): void
    {
        foreach ([$this->customer, ...array_values($this->staff)] as $user) {
            $user->notifications()->delete();
        }
    }

    /**
     * @param  list<string>  $expected  clés de $this->staff qui doivent avoir reçu l'alerte
     */
    private function assertAlerted(array $expected, string $type): void
    {
        foreach ($this->staff as $key => $user) {
            $types = $user->notifications()->pluck('data')->map(fn ($data) => $data['type'] ?? null)->all();

            in_array($key, $expected, true)
                ? $this->assertSame([$type], $types, "$key doit recevoir une alerte $type")
                : $this->assertSame([], $types, "$key ne doit rien recevoir");
        }
    }
}
