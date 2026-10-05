<?php

namespace Tests\Feature\Realtime;

use App\Enums\AccessSpace;
use App\Enums\PaymentStatus;
use App\Enums\ReservationStatus;
use App\Enums\RoleName;
use App\Enums\TripStatus;
use App\Events\LiveUpdate;
use App\Models\Agency;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Trip;
use App\Models\User;
use App\Models\Vehicle;
use App\Support\LiveUpdates;
use Illuminate\Broadcasting\Broadcasters\Broadcaster;
use Illuminate\Broadcasting\BroadcastManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Tests\Concerns\AuthenticatesInSpace;
use Tests\Concerns\CreatesUsers;
use Tests\TestCase;

/**
 * Temps réel (phase 2) : signaux envoyés aux bons canaux, sans données métier,
 * autorisation des canaux privés selon l'espace et le périmètre, et aucune action
 * bloquée si le serveur temps réel est indisponible.
 */
class LiveUpdatesTest extends TestCase
{
    use AuthenticatesInSpace, CreatesUsers, RefreshDatabase;

    private Agency $agency;

    private Trip $trip;

    private User $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRoles();
        $this->agency = Agency::factory()->create();
        $vehicle = Vehicle::factory()->for($this->agency)->create(['capacity' => 30]);
        $this->trip = Trip::factory()->for($this->agency)->for($vehicle)->create([
            'travel_class_id' => $vehicle->travel_class_id,
            'departure_date' => now()->addDays(2)->toDateString(),
            'status' => TripStatus::Published,
        ]);
        $this->customer = $this->customer();

        // Signaux de la préparation déjà envoyés : chaque test n'observe que les siens.
        app(LiveUpdates::class)->flush();
    }

    public function test_a_new_reservation_signals_the_agency_the_customer_and_public_availability(): void
    {
        Event::fake([LiveUpdate::class]);

        $id = $this->asCustomer($this->customer)->postJson('/api/v1/account/reservations', [
            'trip_id' => $this->trip->id,
            'passengers' => [['full_name' => 'Awa Nkoulou', 'passenger_type' => 'adult']],
        ])->assertCreated()->json('data.id');

        $events = $this->dispatchedByChannel();

        $this->assertSame(
            ['admin', 'agency.'.$this->agency->id, 'organization.'.$this->agency->organization_id, 'trips', 'user.'.$this->customer->id],
            array_keys($events),
        );
        $this->assertContains('reservations', $events['agency.'.$this->agency->id]->topics);
        $this->assertSame([$id], $events['agency.'.$this->agency->id]->ids['reservation']);
        $this->assertSame(['reservation' => [$id]], $events['user.'.$this->customer->id]->ids);
        $this->assertSame(['dashboard'], $events['admin']->topics);
        $this->assertSame([], $events['admin']->ids);

        // Canal public : uniquement la disponibilité du trajet, rien sur la réservation ni le client.
        $this->assertSame(['topics' => ['availability'], 'ids' => ['trip' => [$this->trip->id]]], $events['trips']->broadcastWith());
        $this->assertSame('live.update', $events['trips']->broadcastAs());
    }

    public function test_one_signal_per_channel_even_when_many_records_change(): void
    {
        Reservation::factory()->count(3)->for($this->trip)->create(['status' => ReservationStatus::Confirmed]);
        app(LiveUpdates::class)->flush();
        Event::fake([LiveUpdate::class]);

        $manager = $this->staff(RoleName::AgencyManager, $this->agency);
        $this->asAgency($manager)->postJson("/api/v1/agency/trips/{$this->trip->id}/cancel")->assertOk();

        $channels = Event::dispatched(LiveUpdate::class)->map(fn (array $event) => $event[0]->channel->name)->all();
        $this->assertSame($channels, array_values(array_unique($channels)));
        $this->assertContains('private-agency.'.$this->agency->id, $channels);
    }

    public function test_no_signal_for_a_rolled_back_transaction(): void
    {
        Event::fake([LiveUpdate::class]);

        try {
            DB::transaction(function () {
                Reservation::factory()->for($this->trip)->create();
                throw new RuntimeException('Annulée');
            });
        } catch (RuntimeException) {
        }

        app(LiveUpdates::class)->flush();
        Event::assertNotDispatched(LiveUpdate::class);
    }

    public function test_bulk_status_changes_are_signalled(): void
    {
        $reservation = Reservation::factory()->for($this->trip)->for($this->customer)->create([
            'status' => ReservationStatus::Pending, 'expires_at' => now()->subMinute(), 'confirmed_at' => null,
        ]);
        app(LiveUpdates::class)->flush();
        Event::fake([LiveUpdate::class]);

        $this->artisan('reservations:expire')->assertSuccessful();
        app(LiveUpdates::class)->flush();

        $this->assertSame(ReservationStatus::Expired, $reservation->fresh()->status);
        $this->assertArrayHasKey('user.'.$this->customer->id, $this->dispatchedByChannel());
    }

    public function test_payment_result_signals_the_customer_and_the_agency(): void
    {
        config(['payments.driver' => 'mock']);
        $reservation = Reservation::factory()->for($this->trip)->for($this->customer)->pending()->create();
        $payment = Payment::factory()->for($reservation)->create([
            'amount' => $reservation->total_amount, 'status' => PaymentStatus::Processing,
            'provider' => 'mock', 'transaction_reference' => 'MOCK-LIVE',
        ]);
        app(LiveUpdates::class)->flush();
        Event::fake([LiveUpdate::class]);

        $this->asCustomer($this->customer)->postJson("/api/v1/account/payments/{$payment->id}/simulate", ['outcome' => 'paid'])->assertOk();

        $events = $this->dispatchedByChannel();
        $this->assertContains('payments', $events['agency.'.$this->agency->id]->topics);
        $this->assertContains('notifications', $events['user.'.$this->customer->id]->topics);
        $this->assertSame([$payment->id], $events['user.'.$this->customer->id]->ids['payment']);
    }

    public function test_an_unavailable_realtime_server_never_blocks_an_action(): void
    {
        app(BroadcastManager::class)->extend('failing', fn () => new class extends Broadcaster
        {
            public function auth($request) {}

            public function validAuthenticationResponse($request, $result) {}

            public function broadcast(array $channels, $event, array $payload = []): void
            {
                throw new RuntimeException('Reverb injoignable');
            }
        });
        config(['broadcasting.connections.failing' => ['driver' => 'failing'], 'broadcasting.default' => 'failing']);
        Log::spy();

        $this->asCustomer($this->customer)->postJson('/api/v1/account/reservations', [
            'trip_id' => $this->trip->id,
            'passengers' => [['full_name' => 'Awa Nkoulou', 'passenger_type' => 'adult']],
        ])->assertCreated();

        $this->assertSame(1, Reservation::count());
        Log::shouldHaveReceived('warning')->withArgs(fn (string $message) => $message === 'Temps réel : signal non diffusé.');
    }

    public function test_private_channels_are_authorized_by_space_and_scope(): void
    {
        $this->useReverbBroadcaster();

        $other = Agency::factory()->create();
        $manager = $this->staff(RoleName::AgencyManager, $this->agency);
        $director = $this->director($this->agency->organization);
        $admin = $this->superAdmin();
        $agencyId = $this->agency->id;
        $organizationId = $this->agency->organization_id;

        $allowed = [
            [$manager, 'agency', "private-agency.$agencyId"],
            // Canal personnel (notifications) : le compte lui-même, quel que soit son espace.
            [$manager, 'agency', "private-user.{$manager->id}"],
            [$director, 'agency', "private-agency.$agencyId"],
            [$director, 'agency', "private-organization.$organizationId"],
            [$this->customer, 'customer', "private-user.{$this->customer->id}"],
            [$admin, 'admin', 'private-admin'],
        ];
        $refused = [
            [$manager, 'agency', "private-agency.{$other->id}"],
            [$manager, 'agency', "private-organization.$organizationId"],
            [$manager, 'agency', 'private-admin'],
            [$manager, 'agency', 'private-agency.abc'],
            [$director, 'agency', "private-organization.{$other->organization_id}"],
            [$this->customer, 'customer', "private-agency.$agencyId"],
            [$this->customer, 'customer', "private-user.{$manager->id}"],
            [$this->customer, 'customer', 'private-admin'],
            // Le super_admin n'écoute pas les canaux d'agence depuis l'espace administrateur.
            [$admin, 'admin', "private-agency.$agencyId"],
        ];

        foreach ($allowed as [$user, $space, $channel]) {
            $this->authorizeChannel($user, $space, $channel)->assertOk()->assertJsonStructure(['auth']);
        }

        foreach ($refused as [$user, $space, $channel]) {
            $status = $this->authorizeChannel($user, $space, $channel)->status();
            $this->assertSame(403, $status, "$space → $channel");
        }

        $this->app['auth']->forgetGuards();
        $this->withoutToken()->postJson('/api/broadcasting/auth', ['socket_id' => '1.1', 'channel_name' => 'private-admin'])->assertUnauthorized();
    }

    /**
     * @return array<string, LiveUpdate> événements diffusés, par nom de canal (sans préfixe « private- »)
     */
    private function dispatchedByChannel(): array
    {
        $events = [];
        foreach (Event::dispatched(LiveUpdate::class) as [$event]) {
            $events[str_replace('private-', '', $event->channel->name)] = $event;
        }
        ksort($events);

        return $events;
    }

    private function authorizeChannel(User $user, string $space, string $channel)
    {
        return $this->actingInSpace($user, AccessSpace::from($space))
            ->postJson('/api/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => $channel]);
    }

    /**
     * Pilote Reverb avec des identifiants de test (aucun appel réseau pour l'autorisation),
     * et canaux réenregistrés sur ce pilote.
     */
    private function useReverbBroadcaster(): void
    {
        config([
            'broadcasting.default' => 'reverb',
            'broadcasting.connections.reverb.key' => 'test-key',
            'broadcasting.connections.reverb.secret' => 'test-secret',
            'broadcasting.connections.reverb.app_id' => '1',
            'broadcasting.connections.reverb.options.host' => 'localhost',
            'broadcasting.connections.reverb.options.port' => 8080,
            'broadcasting.connections.reverb.options.scheme' => 'http',
        ]);
        Broadcast::forgetDrivers();
        require base_path('routes/channels.php');
    }
}
