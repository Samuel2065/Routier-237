<?php

namespace Tests\Feature;

use App\Enums\TripStatus;
use App\Models\City;
use App\Models\Reservation;
use App\Models\TravelClass;
use App\Models\Trip;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Parcours complet sur les données de démonstration, du voyageur anonyme au remboursement,
 * vérifiant les critères d'acceptation du cahier des charges (§25, A1 à A11).
 * Traçabilité complète : section « Critères d'acceptation » du README.
 */
class AcceptanceJourneyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['payments.driver' => 'mock']);
        $this->seed(DatabaseSeeder::class);
    }

    private function login(string $url, string $email, string $password = 'password'): string
    {
        $this->app['auth']->forgetGuards();

        return $this->withoutToken()->postJson($url, ['email' => $email, 'password' => $password])->assertOk()->json('data.token');
    }

    private function as(string $token): static
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token);
    }

    private function search(string $date): TestResponse
    {
        $this->app['auth']->forgetGuards();

        return $this->withoutToken()->getJson('/api/v1/trips/search?'.http_build_query([
            'departure_city_id' => City::where('slug', 'bertoua')->value('id'),
            'destination_city_id' => City::where('slug', 'yaounde')->value('id'),
            'date' => $date,
        ]));
    }

    public function test_complete_journey_meets_the_acceptance_criteria(): void
    {
        $tomorrow = now()->addDay()->toDateString();

        // A1 — un visiteur recherche sans compte. A3 — agence, horaire, prix, classe, disponibilité.
        $results = $this->search($tomorrow)
            ->assertOk()
            ->assertJsonStructure(['data' => [['agency' => ['name'], 'departure_time', 'price', 'travel_class' => ['name'], 'remaining_seats']]]);
        $this->assertNotEmpty($results->json('data'));

        // A2 — seuls les trajets publiés et disponibles : les brouillons (J+8) n'apparaissent pas.
        $this->assertSame(0, $this->search(now()->addDays(8)->toDateString())->json('meta.count'));
        $this->assertTrue(Trip::whereDate('departure_date', now()->addDays(8))->where('status', TripStatus::Draft)->exists());

        // A4 — VIP et Classique sont des véhicules distincts, chacun avec sa capacité.
        $classes = collect($results->json('data'))->pluck('travel_class.code')->unique()->values()->all();
        $this->assertEqualsCanonicalizing([TravelClass::VIP, TravelClass::CLASSIQUE], $classes);
        $vipTrip = Trip::findOrFail(collect($results->json('data'))->firstWhere('travel_class.code', TravelClass::VIP)['id']);
        $classicTrip = Trip::findOrFail(collect($results->json('data'))->firstWhere('travel_class.code', TravelClass::CLASSIQUE)['id']);
        $this->assertNotSame($vipTrip->vehicle_id, $classicTrip->vehicle_id);

        // Le compte n'est créé qu'au moment de réserver (inscription client uniquement).
        $this->app['auth']->forgetGuards();
        $customerToken = $this->withoutToken()->postJson('/api/v1/auth/register', [
            'name' => 'Awa Nkoulou',
            'email' => 'awa@example.test',
            'password' => 'Voyage2026',
            'password_confirmation' => 'Voyage2026',
        ])->assertCreated()->assertJsonPath('data.user.role', 'customer')->json('data.token');

        // A5 — plusieurs passagers dans une même réservation, dont un enfant sans compte.
        // A7 — aucun siège numéroté : seules les places restantes diminuent.
        $reservation = $this->as($customerToken)->postJson('/api/v1/account/reservations', [
            'trip_id' => $vipTrip->id,
            'passengers' => [
                ['full_name' => 'Awa Nkoulou', 'passenger_type' => 'adult'],
                ['full_name' => 'Paul Nkoulou', 'passenger_type' => 'adult'],
                ['full_name' => 'Petit Nkoulou', 'passenger_type' => 'child', 'birth_date' => '2019-04-12'],
            ],
        ])->assertCreated()->assertJsonPath('data.passenger_count', 3)->assertJsonMissingPath('data.passengers.0.seat_number');
        $reservationId = $reservation->json('data.id');
        $this->assertSame($vipTrip->vehicle->capacity - 3, $vipTrip->fresh()->remainingSeats());

        // A8 — Orange Money, MTN MoMo et carte sont représentés ; paiement MTN MoMo (simulé).
        $paymentId = $this->as($customerToken)->postJson("/api/v1/account/reservations/{$reservationId}/payments", [
            'method' => 'mtn_momo',
            'phone' => '677000000',
        ])->assertCreated()->json('data.id');
        $this->as($customerToken)->postJson("/api/v1/account/payments/{$paymentId}/simulate", ['outcome' => 'paid'])
            ->assertOk()
            ->assertJsonPath('data.reservation.status', 'confirmed');

        // A9 — un client ne consulte que ses propres réservations.
        $otherToken = $this->login('/api/v1/auth/login', 'client@routier237.test');
        $this->as($otherToken)->getJson("/api/v1/account/reservations/{$reservationId}")->assertForbidden();
        $this->as($otherToken)->getJson('/api/v1/account/reservations')->assertJsonMissing(['id' => $reservationId]);

        // A10 — l'agence d'Yaoundé ne manipule pas les données de l'agence de Bertoua.
        $yaoundeToken = $this->login('/api/v1/agency/auth/login', 'manager.yaounde@routier237.test');
        $this->as($yaoundeToken)->getJson("/api/v1/agency/reservations/{$reservationId}")->assertForbidden();
        $this->as($yaoundeToken)->postJson("/api/v1/agency/trips/{$vipTrip->id}/cancel")->assertForbidden();
        $this->assertSame(TripStatus::Published, $vipTrip->fresh()->status);

        // Le guichet de Bertoua retrouve la réservation par sa référence.
        $clerkToken = $this->login('/api/v1/agency/auth/login', 'guichet.bertoua@routier237.test');
        $reference = Reservation::findOrFail($reservationId)->reference;
        $this->as($clerkToken)->getJson('/api/v1/agency/reservations?search='.$reference)->assertJsonPath('data.0.id', $reservationId);

        // A11 — rôles et permissions vérifiés côté Laravel : le guichet ne rembourse pas, le comptable oui.
        $this->as($clerkToken)->postJson("/api/v1/agency/payments/{$paymentId}/refund")->assertForbidden();
        $accountantToken = $this->login('/api/v1/agency/auth/login', 'comptable.bertoua@routier237.test');
        $this->as($accountantToken)->postJson("/api/v1/agency/payments/{$paymentId}/refund")
            ->assertOk()
            ->assertJsonPath('data.status', 'refunded')
            ->assertJsonPath('data.reservation.status', 'cancelled');

        // A6 — impossible de dépasser la capacité : le trajet est rempli puis une place de plus est refusée.
        $remaining = $classicTrip->fresh()->remainingSeats();
        $customer = User::where('email', 'awa@example.test')->firstOrFail();
        Reservation::factory()->for($classicTrip)->for($customer)->create(['passenger_count' => $remaining]);
        $this->as($customerToken)->postJson('/api/v1/account/reservations', [
            'trip_id' => $classicTrip->id,
            'passengers' => [['full_name' => 'Voyageur de trop', 'passenger_type' => 'adult']],
        ])->assertStatus(409);
        $this->assertSame(0, $classicTrip->fresh()->remainingSeats());
    }
}
