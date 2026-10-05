<?php

namespace Tests\Feature\Notifications;

use App\Enums\AccessSpace;
use App\Enums\PaymentStatus;
use App\Enums\RoleName;
use App\Enums\TripStatus;
use App\Models\Agency;
use App\Models\DeviceToken;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Trip;
use App\Models\User;
use App\Models\Vehicle;
use App\Support\Push\AccessTokenProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\AuthenticatesInSpace;
use Tests\Concerns\CreatesUsers;
use Tests\TestCase;

/**
 * Phase 3b : inscription des appareils et envoi des notifications push (Firebase Cloud
 * Messaging), sans jamais appeler Google (jeton d'accès et API FCM simulés).
 */
class PushNotificationTest extends TestCase
{
    use AuthenticatesInSpace, CreatesUsers, RefreshDatabase;

    private const FCM_URL = 'https://fcm.googleapis.com/v1/projects/projet-test/messages:send';

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRoles();
        config(['services.fcm.enabled' => true, 'payments.driver' => 'mock']);
        $this->app->instance(AccessTokenProvider::class, new class implements AccessTokenProvider
        {
            public function token(): string
            {
                return 'jeton-acces-test';
            }

            public function projectId(): string
            {
                return 'projet-test';
            }
        });
    }

    public function test_a_device_is_registered_for_the_signed_in_account_and_removed_on_logout(): void
    {
        $customer = $this->customer();
        $token = str_repeat('a', 40);

        $this->asCustomer($customer)->postJson('/api/v1/auth/push-tokens', ['token' => $token])->assertNoContent();
        // Renouvellement : même appareil, aucune ligne en double.
        $this->asCustomer($customer)->postJson('/api/v1/auth/push-tokens', ['token' => $token])->assertNoContent();

        $device = DeviceToken::query()->sole();
        $this->assertSame($customer->id, $device->user_id);
        $this->assertNotNull($device->personal_access_token_id);
        $this->assertArrayNotHasKey('token', $device->toArray());

        // La déconnexion révoque le jeton Sanctum : l'appareil disparaît avec lui.
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/auth/logout')->assertNoContent();
        $this->assertSame(0, DeviceToken::query()->count());
    }

    public function test_a_shared_browser_follows_the_account_currently_signed_in(): void
    {
        $first = $this->customer();
        $second = $this->staff(RoleName::CounterClerk, Agency::factory()->create());
        $token = str_repeat('b', 40);

        $this->asCustomer($first)->postJson('/api/v1/auth/push-tokens', ['token' => $token])->assertNoContent();
        $this->actingInSpace($second, AccessSpace::Agency)->postJson('/api/v1/auth/push-tokens', ['token' => $token])->assertNoContent();

        $this->assertSame($second->id, DeviceToken::query()->sole()->user_id);
    }

    public function test_a_device_can_be_unregistered_only_by_its_owner(): void
    {
        $owner = $this->customer();
        $other = $this->customer();
        $token = str_repeat('c', 40);
        $this->asCustomer($owner)->postJson('/api/v1/auth/push-tokens', ['token' => $token])->assertNoContent();

        $this->asCustomer($other)->deleteJson('/api/v1/auth/push-tokens', ['token' => $token])->assertNoContent();
        $this->assertSame(1, DeviceToken::query()->count());

        $this->asCustomer($owner)->deleteJson('/api/v1/auth/push-tokens', ['token' => $token])->assertNoContent();
        $this->assertSame(0, DeviceToken::query()->count());

        $this->asCustomer($owner)->postJson('/api/v1/auth/push-tokens', ['token' => 'court'])->assertUnprocessable();
        $this->app['auth']->forgetGuards();
        $this->withoutToken()->postJson('/api/v1/auth/push-tokens', ['token' => $token])->assertUnauthorized();
    }

    public function test_a_notification_is_pushed_to_each_device_with_its_database_id(): void
    {
        Http::fake([
            self::FCM_URL => Http::sequence()
                ->push(['name' => 'projects/projet-test/messages/1'])
                ->push(['error' => ['code' => 404, 'status' => 'NOT_FOUND', 'details' => [['errorCode' => 'UNREGISTERED']]]], 404),
        ]);

        [$customer, $payment] = $this->customerWithPendingPayment();
        $valid = $this->registerDevice($customer, str_repeat('v', 40));
        $stale = $this->registerDevice($customer, str_repeat('s', 40));

        $this->asCustomer($customer)->postJson("/api/v1/account/payments/{$payment->id}/simulate", ['outcome' => 'paid'])->assertOk();

        $notificationId = $customer->notifications()->sole()->id;
        Http::assertSentCount(2);
        Http::assertSent(fn (Request $request) => $request->hasHeader('Authorization', 'Bearer jeton-acces-test')
            && $request['message']['data']['notification_id'] === $notificationId
            && $request['message']['data']['title'] === 'Réservation confirmée'
            && $request['message']['data']['link'] === "/account/reservations/{$payment->reservation_id}"
            && ! isset($request['message']['notification']));

        // Jeton déclaré invalide par Firebase : supprimé ; l'autre appareil est conservé.
        $this->assertTrue(DeviceToken::query()->whereKey($valid->id)->exists());
        $this->assertFalse(DeviceToken::query()->whereKey($stale->id)->exists());
    }

    public function test_nothing_is_sent_without_device_or_when_push_is_disabled(): void
    {
        Http::fake();
        [$customer, $payment] = $this->customerWithPendingPayment();

        $this->asCustomer($customer)->postJson("/api/v1/account/payments/{$payment->id}/simulate", ['outcome' => 'paid'])->assertOk();
        Http::assertNothingSent();

        config(['services.fcm.enabled' => false]);
        [$other, $otherPayment] = $this->customerWithPendingPayment();
        $this->registerDevice($other, str_repeat('d', 40));
        $this->asCustomer($other)->postJson("/api/v1/account/payments/{$otherPayment->id}/simulate", ['outcome' => 'paid'])->assertOk();
        Http::assertNothingSent();
    }

    public function test_a_firebase_outage_never_blocks_the_payment(): void
    {
        Http::fake([self::FCM_URL => Http::response(['error' => ['code' => 503, 'status' => 'UNAVAILABLE']], 503)]);
        [$customer, $payment] = $this->customerWithPendingPayment();
        $device = $this->registerDevice($customer, str_repeat('e', 40));

        $this->asCustomer($customer)->postJson("/api/v1/account/payments/{$payment->id}/simulate", ['outcome' => 'paid'])
            ->assertOk()
            ->assertJsonPath('data.status', PaymentStatus::Paid->value);

        // Erreur temporaire : l'appareil n'est pas supprimé.
        $this->assertTrue(DeviceToken::query()->whereKey($device->id)->exists());
    }

    /**
     * @return array{User, Payment}
     */
    private function customerWithPendingPayment(): array
    {
        $agency = Agency::factory()->create();
        $vehicle = Vehicle::factory()->for($agency)->create();
        $trip = Trip::factory()->for($agency)->for($vehicle)->create([
            'travel_class_id' => $vehicle->travel_class_id, 'status' => TripStatus::Published,
        ]);
        $customer = $this->customer();
        $reservation = Reservation::factory()->for($trip)->for($customer)->pending()->create();
        $payment = Payment::factory()->for($reservation)->create([
            'amount' => $reservation->total_amount, 'status' => PaymentStatus::Processing,
            'provider' => 'mock', 'transaction_reference' => 'MOCK-PUSH-'.$reservation->id,
        ]);

        return [$customer, $payment];
    }

    private function registerDevice(User $user, string $token): DeviceToken
    {
        $this->asCustomer($user)->postJson('/api/v1/auth/push-tokens', ['token' => $token])->assertNoContent();

        return DeviceToken::query()->where('token_hash', DeviceToken::hashOf($token))->sole();
    }
}
