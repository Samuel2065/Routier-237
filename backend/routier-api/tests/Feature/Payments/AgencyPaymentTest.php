<?php

namespace Tests\Feature\Payments;

use App\Enums\PaymentStatus;
use App\Enums\ReservationStatus;
use App\Enums\RoleName;
use App\Enums\TripStatus;
use App\Models\Agency;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Trip;
use App\Notifications\ReservationCancelled;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\AuthenticatesInSpace;
use Tests\Concerns\CreatesUsers;
use Tests\TestCase;

/**
 * Suivi des paiements et remboursements côté agence, et notifications d'annulation.
 */
class AgencyPaymentTest extends TestCase
{
    use AuthenticatesInSpace, CreatesUsers, RefreshDatabase;

    private Agency $agency;

    private Trip $trip;

    protected function setUp(): void
    {
        parent::setUp();

        config(['payments.driver' => 'mock']);
        $this->seedRoles();
        $this->agency = Agency::factory()->for(Organization::factory())->create();
        $this->trip = Trip::factory()->for($this->agency)->create(['status' => TripStatus::Published]);
    }

    private function paidPayment(ReservationStatus $reservationStatus = ReservationStatus::Confirmed, ?Trip $trip = null): Payment
    {
        $reservation = Reservation::factory()->for($trip ?? $this->trip)->create(['status' => $reservationStatus]);
        $reservation->user->assignRole(RoleName::Customer->value);

        return Payment::factory()->for($reservation)->create([
            'status' => PaymentStatus::Paid,
            'provider' => 'mock',
            'transaction_reference' => 'MOCK-'.fake()->unique()->bothify('########'),
            'paid_at' => now(),
        ]);
    }

    public function test_staff_follow_payments_of_their_agency_only(): void
    {
        $own = $this->paidPayment();
        $toRefund = $this->paidPayment(ReservationStatus::Cancelled);
        $this->paidPayment(trip: Trip::factory()->create());

        $accountant = $this->staff(RoleName::Accountant, $this->agency);

        $this->asAgency($accountant)->getJson('/api/v1/agency/payments')
            ->assertOk()
            ->assertJsonPath('meta.total', 2);

        $this->asAgency($accountant)->getJson('/api/v1/agency/payments?requires_refund=1')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $toRefund->id)
            ->assertJsonPath('data.0.requires_refund', true);

        $this->asAgency($accountant)->getJson("/api/v1/agency/payments/{$own->id}")->assertOk();

        $driver = $this->staff(RoleName::Driver, $this->agency);
        $this->asAgency($driver)->getJson('/api/v1/agency/payments')->assertForbidden();
    }

    public function test_accountant_refunds_and_the_reservation_is_cancelled(): void
    {
        Notification::fake();
        $payment = $this->paidPayment();
        $accountant = $this->staff(RoleName::Accountant, $this->agency);

        $this->asAgency($accountant)->postJson("/api/v1/agency/payments/{$payment->id}/refund")
            ->assertOk()
            ->assertJsonPath('data.status', 'refunded')
            ->assertJsonPath('data.reservation.status', 'cancelled');

        Notification::assertSentTo($payment->reservation->user, ReservationCancelled::class);

        // Double remboursement impossible.
        $this->asAgency($accountant)->postJson("/api/v1/agency/payments/{$payment->id}/refund")->assertStatus(409);
    }

    public function test_refund_permissions_and_rules(): void
    {
        $payment = $this->paidPayment();
        $foreign = $this->paidPayment(trip: Trip::factory()->create());
        $processing = Payment::factory()->for(Reservation::factory()->for($this->trip)->pending())->create([
            'status' => PaymentStatus::Processing, 'provider' => 'mock', 'transaction_reference' => 'MOCK-PROC',
        ]);

        $clerk = $this->staff(RoleName::CounterClerk, $this->agency);
        $this->asAgency($clerk)->postJson("/api/v1/agency/payments/{$payment->id}/refund")->assertForbidden();

        $accountant = $this->staff(RoleName::Accountant, $this->agency);
        $this->asAgency($accountant)->postJson("/api/v1/agency/payments/{$foreign->id}/refund")->assertForbidden();
        $this->asAgency($accountant)->postJson("/api/v1/agency/payments/{$processing->id}/refund")->assertStatus(409);

        // Passerelle réelle non intégrée : remboursement indisponible, rien ne change.
        config(['payments.driver' => 'live']);
        $this->asAgency($accountant)->postJson("/api/v1/agency/payments/{$payment->id}/refund")->assertStatus(503);
        $this->assertSame(PaymentStatus::Paid, $payment->fresh()->status);
    }

    public function test_customers_are_notified_of_cancellations_by_the_agency(): void
    {
        Notification::fake();
        $manager = $this->staff(RoleName::AgencyManager, $this->agency);

        $single = Reservation::factory()->for($this->trip)->create();
        $this->asAgency($manager)->postJson("/api/v1/agency/reservations/{$single->id}/cancel")->assertOk();
        Notification::assertSentTo($single->user, ReservationCancelled::class, fn ($n) => $n->reason === ReservationCancelled::BY_AGENCY);

        $a = Reservation::factory()->for($this->trip)->create();
        $b = Reservation::factory()->for($this->trip)->pending()->create();
        $this->asAgency($manager)->postJson("/api/v1/agency/trips/{$this->trip->id}/cancel")->assertOk();

        foreach ([$a, $b] as $reservation) {
            Notification::assertSentTo($reservation->user, ReservationCancelled::class, fn ($n) => $n->reason === ReservationCancelled::TRIP_CANCELLED);
        }
    }
}
