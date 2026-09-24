<?php

namespace Tests\Feature\Payments;

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\ReservationStatus;
use App\Enums\TripStatus;
use App\Models\Agency;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Trip;
use App\Models\User;
use App\Models\Vehicle;
use App\Notifications\PaymentFailed;
use App\Notifications\ReservationConfirmed;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use Tests\Concerns\AuthenticatesInSpace;
use Tests\Concerns\CreatesUsers;
use Tests\TestCase;

/**
 * Parcours de paiement (§10, critère A8) avec la passerelle simulée.
 */
class PaymentFlowTest extends TestCase
{
    use AuthenticatesInSpace, CreatesUsers, RefreshDatabase;

    private User $customer;

    private Reservation $reservation;

    protected function setUp(): void
    {
        parent::setUp();

        config(['payments.driver' => 'mock']);
        $this->seedRoles();
        $this->customer = $this->customer();

        $agency = Agency::factory()->create();
        $vehicle = Vehicle::factory()->for($agency)->create(['capacity' => 30]);
        $trip = Trip::factory()->for($agency)->for($vehicle)->create([
            'travel_class_id' => $vehicle->travel_class_id,
            'price' => 7000,
            'status' => TripStatus::Published,
        ]);
        $this->reservation = Reservation::factory()->for($trip)->for($this->customer)->pending()->create([
            'passenger_count' => 2,
            'total_amount' => 14000,
        ]);
    }

    private function pay(array $payload, ?Reservation $reservation = null): TestResponse
    {
        $reservation ??= $this->reservation;

        return $this->asCustomer($this->customer)->postJson("/api/v1/account/reservations/{$reservation->id}/payments", $payload);
    }

    public function test_each_payment_method_is_supported(): void
    {
        // Critère A8 : Orange Money, MTN MoMo et carte sont représentés dans le modèle de paiement.
        $this->assertEqualsCanonicalizing(['orange_money', 'mtn_momo', 'card'], PaymentMethod::values());

        foreach ([['orange_money', '699000001'], ['mtn_momo', '677000002'], ['card', null]] as [$method, $phone]) {
            $reservation = Reservation::factory()->for($this->reservation->trip)->for($this->customer)->pending()->create();

            $this->pay(array_filter(['method' => $method, 'phone' => $phone]), $reservation)
                ->assertCreated()
                ->assertJsonPath('data.method', $method)
                ->assertJsonPath('data.provider', 'mock')
                ->assertJsonPath('data.status', 'processing')
                ->assertJsonPath('data.payer_phone', $phone)
                ->assertJsonPath('data.amount', $reservation->total_amount);
        }
    }

    public function test_a_successful_payment_confirms_the_reservation(): void
    {
        Notification::fake();

        $paymentId = $this->pay(['method' => 'orange_money', 'phone' => '699 00 00 01'])
            ->assertCreated()
            ->assertJsonPath('data.amount', 14000)
            ->assertJsonPath('data.currency', 'XAF')
            ->assertJsonPath('data.payer_phone', '699000001')
            ->assertJsonStructure(['meta' => ['instructions', 'redirect_url']])
            ->json('data.id');

        $payment = Payment::findOrFail($paymentId);
        $this->assertStringStartsWith('MOCK-', $payment->transaction_reference);

        $this->asCustomer($this->customer)->postJson("/api/v1/account/payments/{$paymentId}/simulate", ['outcome' => 'paid'])
            ->assertOk()
            ->assertJsonPath('data.status', 'paid')
            ->assertJsonPath('data.reservation.status', 'confirmed')
            ->assertJsonPath('data.requires_refund', false);

        $reservation = $this->reservation->fresh();
        $this->assertSame(ReservationStatus::Confirmed, $reservation->status);
        $this->assertNotNull($reservation->confirmed_at);
        $this->assertNull($reservation->expires_at);
        $this->assertNotNull($payment->fresh()->paid_at);

        Notification::assertSentTo($this->customer, ReservationConfirmed::class);

        $this->asCustomer($this->customer)->getJson("/api/v1/account/reservations/{$this->reservation->id}")
            ->assertJsonPath('data.status', 'confirmed')
            ->assertJsonPath('data.payments.0.status', 'paid');
    }

    public function test_a_failed_payment_can_be_retried(): void
    {
        Notification::fake();

        $first = $this->pay(['method' => 'mtn_momo', 'phone' => '677000000'])->json('data.id');

        // Un seul paiement actif à la fois.
        $this->pay(['method' => 'card'])->assertStatus(409);

        $this->asCustomer($this->customer)->postJson("/api/v1/account/payments/{$first}/simulate", ['outcome' => 'failed'])
            ->assertOk()
            ->assertJsonPath('data.status', 'failed')
            ->assertJsonPath('data.reservation.status', 'pending');
        Notification::assertSentTo($this->customer, PaymentFailed::class);

        $this->pay(['method' => 'card'])->assertCreated();
    }

    public function test_payment_requests_are_validated(): void
    {
        $this->pay(['method' => 'paypal'])->assertUnprocessable()->assertJsonValidationErrors('method');
        $this->pay(['method' => 'orange_money'])->assertUnprocessable()->assertJsonValidationErrors('phone');
        $this->pay(['method' => 'mtn_momo', 'phone' => '12345'])->assertUnprocessable()->assertJsonValidationErrors('phone');
        $this->pay(['method' => 'card', 'phone' => '699000000'])->assertUnprocessable()->assertJsonValidationErrors('phone');

        $this->assertSame(0, Payment::count());
    }

    public function test_only_pending_and_valid_reservations_can_be_paid(): void
    {
        $confirmed = Reservation::factory()->for($this->reservation->trip)->for($this->customer)->create();
        $this->pay(['method' => 'card'], $confirmed)->assertStatus(409);

        $this->travelTo(now()->addMinutes(20));
        $this->pay(['method' => 'card'])
            ->assertStatus(409)
            ->assertJsonPath('message', 'Le délai de paiement de cette réservation est dépassé.');

        $this->assertSame(0, Payment::count());
    }

    public function test_a_customer_cannot_pay_or_view_someone_elses_payment(): void
    {
        $other = $this->customer();
        $foreignReservation = Reservation::factory()->for($this->reservation->trip)->for($other)->pending()->create();

        $this->pay(['method' => 'card'], $foreignReservation)->assertForbidden();

        $paymentId = $this->pay(['method' => 'card'])->json('data.id');
        $this->asCustomer($other)->getJson("/api/v1/account/payments/{$paymentId}")->assertForbidden();
        $this->asCustomer($other)->postJson("/api/v1/account/payments/{$paymentId}/simulate", ['outcome' => 'paid'])
            ->assertForbidden();

        $this->assertSame(PaymentStatus::Processing, Payment::findOrFail($paymentId)->status);
    }

    public function test_real_gateways_are_unavailable_until_integrated(): void
    {
        config(['payments.driver' => 'live']);

        foreach ([['orange_money', '699000000', 'Orange Money'], ['mtn_momo', '677000000', 'MTN MoMo'], ['card', null, 'carte bancaire']] as [$method, $phone, $label]) {
            $this->pay(array_filter(['method' => $method, 'phone' => $phone]))
                ->assertStatus(503)
                ->assertJsonPath('message', "Le paiement par {$label} n'est pas encore disponible.");
        }

        // Aucun paiement fantôme n'est enregistré, la simulation est fermée.
        $this->assertSame(0, Payment::count());
    }

    public function test_simulated_payments_are_refused_in_production(): void
    {
        $this->app['env'] = 'production';

        $this->pay(['method' => 'card'])
            ->assertStatus(503)
            ->assertJsonPath('message', 'Les paiements simulés sont désactivés en production.');

        $this->assertSame(0, Payment::count());
    }

    public function test_late_payment_is_flagged_for_refund(): void
    {
        $paymentId = $this->pay(['method' => 'card'])->json('data.id');

        // Le client paie après l'expiration de sa réservation.
        $this->travelTo(now()->addMinutes(20));
        $this->artisan('reservations:expire');

        $this->asCustomer($this->customer)->postJson("/api/v1/account/payments/{$paymentId}/simulate", ['outcome' => 'paid'])
            ->assertOk()
            ->assertJsonPath('data.status', 'paid')
            ->assertJsonPath('data.reservation.status', 'expired')
            ->assertJsonPath('data.requires_refund', true);
    }
}
