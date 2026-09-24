<?php

namespace Tests\Feature\Payments;

use App\Enums\PaymentStatus;
use App\Enums\ReservationStatus;
use App\Models\Payment;
use App\Models\Reservation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Webhooks des fournisseurs : signature, idempotence, contrôle du montant.
 */
class PaymentWebhookTest extends TestCase
{
    use RefreshDatabase;

    private const SECRET = 'test-webhook-secret';

    private Payment $payment;

    protected function setUp(): void
    {
        parent::setUp();

        config(['payments.driver' => 'mock', 'payments.mock.webhook_secret' => self::SECRET]);

        $reservation = Reservation::factory()->pending()->create(['total_amount' => 14000]);
        $this->payment = Payment::factory()->for($reservation)->create([
            'amount' => 14000,
            'status' => PaymentStatus::Processing,
            'provider' => 'mock',
            'transaction_reference' => 'MOCK-ABCDEF123456',
        ]);
    }

    private function webhook(array $payload, ?string $signature = null, string $provider = 'mock'): TestResponse
    {
        $body = json_encode($payload);

        return $this->call('POST', "/api/v1/payments/webhooks/{$provider}", [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_X_MOCK_SIGNATURE' => $signature ?? hash_hmac('sha256', $body, self::SECRET),
        ], $body);
    }

    public function test_a_signed_webhook_confirms_the_payment_once(): void
    {
        $payload = ['reference' => 'MOCK-ABCDEF123456', 'status' => 'paid', 'amount' => 14000];

        $this->webhook($payload)->assertOk()->assertJsonPath('data.status', 'paid');
        $this->assertSame(ReservationStatus::Confirmed, $this->payment->reservation->fresh()->status);
        $paidAt = $this->payment->fresh()->paid_at;

        // Rejeu (ou notification contradictoire) : aucun effet.
        $this->travelTo(now()->addMinute());
        $this->webhook($payload)->assertOk();
        $this->webhook(['reference' => 'MOCK-ABCDEF123456', 'status' => 'failed'])->assertOk()->assertJsonPath('data.status', 'paid');
        $this->assertEquals($paidAt, $this->payment->fresh()->paid_at);
    }

    public function test_invalid_signatures_are_rejected(): void
    {
        $this->webhook(['reference' => 'MOCK-ABCDEF123456', 'status' => 'paid'], 'forged-signature')->assertStatus(401);

        config(['payments.mock.webhook_secret' => null]);
        $this->webhook(['reference' => 'MOCK-ABCDEF123456', 'status' => 'paid'], '')->assertStatus(401);

        $this->assertSame(PaymentStatus::Processing, $this->payment->fresh()->status);
    }

    public function test_a_wrong_amount_fails_the_payment(): void
    {
        $this->webhook(['reference' => 'MOCK-ABCDEF123456', 'status' => 'paid', 'amount' => 100])
            ->assertOk()
            ->assertJsonPath('data.status', 'failed');

        $this->assertStringContainsString('différent du montant attendu', $this->payment->fresh()->failure_reason);
        $this->assertSame(ReservationStatus::Pending, $this->payment->reservation->fresh()->status);
    }

    public function test_unknown_payments_and_providers(): void
    {
        $this->webhook(['reference' => 'MOCK-UNKNOWN', 'status' => 'paid'])->assertNotFound();
        $this->webhook(['reference' => 'X', 'status' => 'paid'], null, 'paypal')->assertNotFound();

        // Passerelles réelles non intégrées : indisponibles.
        config(['payments.driver' => 'live']);
        $this->webhook(['reference' => 'X', 'status' => 'paid'], null, 'orange_money')->assertStatus(503);
        // La simulation n'accepte plus de webhooks hors mode mock.
        $this->webhook(['reference' => 'MOCK-ABCDEF123456', 'status' => 'paid'])->assertNotFound();
    }
}
