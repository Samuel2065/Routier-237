<?php

namespace Tests\Feature\Payments;

use App\Enums\PaymentStatus;
use App\Models\Payment;
use App\Models\Reservation;
use App\Notifications\ReservationConfirmed;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Concerns\AuthenticatesInSpace;
use Tests\Concerns\CreatesUsers;
use Tests\TestCase;

/**
 * Notifications applicatives (table notifications Laravel) et e-mail de confirmation.
 */
class CustomerNotificationTest extends TestCase
{
    use AuthenticatesInSpace, CreatesUsers, RefreshDatabase;

    public function test_customer_reads_their_notifications(): void
    {
        $this->seedRoles();
        config(['payments.driver' => 'mock']);
        $customer = $this->customer();
        $other = $this->customer();

        // Paiement confirmé → notification en base + e-mail.
        $reservation = Reservation::factory()->for($customer)->pending()->create();
        $payment = Payment::factory()->for($reservation)->create([
            'amount' => $reservation->total_amount, 'status' => PaymentStatus::Processing,
            'provider' => 'mock', 'transaction_reference' => 'MOCK-NOTIF',
        ]);
        $this->asCustomer($customer)->postJson("/api/v1/account/payments/{$payment->id}/simulate", ['outcome' => 'paid'])->assertOk();

        $this->asCustomer($customer)->getJson('/api/v1/account/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 1)
            ->assertJsonPath('data.0.type', 'reservation_confirmed')
            ->assertJsonPath('data.0.data.reference', $reservation->reference);

        $id = $customer->notifications()->firstOrFail()->id;

        // Les notifications d'un autre client restent inaccessibles.
        $this->asCustomer($other)->postJson("/api/v1/account/notifications/{$id}/read")->assertNotFound();

        $this->asCustomer($customer)->postJson("/api/v1/account/notifications/{$id}/read")->assertNoContent();
        $this->asCustomer($customer)->getJson('/api/v1/account/notifications?unread=1')
            ->assertJsonCount(0, 'data')
            ->assertJsonPath('unread_count', 0);
    }

    public function test_confirmation_email_content(): void
    {
        Mail::fake();
        $reservation = Reservation::factory()->create(['reference' => 'R237-TESTMAIL']);

        $mail = (new ReservationConfirmed($reservation))->toMail($reservation->user);

        $this->assertSame('Réservation R237-TESTMAIL confirmée', $mail->subject);
        $this->assertStringContainsString('R237-TESTMAIL', implode(' ', $mail->introLines));
    }
}
