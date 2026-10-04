<?php

namespace Tests\Feature\Security;

use App\Enums\EmployeeStatus;
use App\Enums\PaymentStatus;
use App\Enums\RoleName;
use App\Models\Agency;
use App\Models\EmployeeProfile;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Trip;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\AuthenticatesInSpace;
use Tests\Concerns\CreatesUsers;
use Tests\TestCase;

/**
 * Accès direct par identifiant (IDOR) sur les vraies routes : changer l'identifiant d'une
 * ressource dans l'URL ne donne jamais accès aux données d'un autre client, d'une autre
 * agence ou d'une autre organisation. Les accès légitimes continuent de fonctionner.
 */
class ResourceIsolationTest extends TestCase
{
    use AuthenticatesInSpace, CreatesUsers, RefreshDatabase;

    private Agency $agencyA;

    private Agency $agencyB;

    private Trip $tripA;

    private Trip $tripB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRoles();

        // Deux organisations distinctes, une agence chacune.
        $this->agencyA = Agency::factory()->for(Organization::factory())->create();
        $this->agencyB = Agency::factory()->for(Organization::factory())->create();
        $this->tripA = Trip::factory()->for($this->agencyA)->create();
        $this->tripB = Trip::factory()->for($this->agencyB)->create();
    }

    public function test_a_customer_cannot_reach_another_customers_reservation_or_payment(): void
    {
        config(['payments.driver' => 'mock']);
        $alice = $this->customer();
        $bob = $this->customer();

        $reservation = Reservation::factory()->for($this->tripA)->for($alice)->pending()->create();
        $payment = Payment::factory()->for($reservation)->create([
            'amount' => $reservation->total_amount, 'status' => PaymentStatus::Processing,
            'provider' => 'mock', 'transaction_reference' => 'MOCK-IDOR',
        ]);

        $this->asCustomer($bob)->getJson("/api/v1/account/reservations/{$reservation->id}")->assertForbidden();
        $this->asCustomer($bob)->postJson("/api/v1/account/reservations/{$reservation->id}/cancel")->assertForbidden();
        $this->asCustomer($bob)->postJson("/api/v1/account/reservations/{$reservation->id}/payments", ['method' => 'card'])->assertForbidden();
        $this->asCustomer($bob)->getJson("/api/v1/account/payments/{$payment->id}")->assertForbidden();
        $this->asCustomer($bob)->postJson("/api/v1/account/payments/{$payment->id}/simulate", ['outcome' => 'paid'])->assertForbidden();
        $this->asCustomer($bob)->getJson('/api/v1/account/reservations')->assertOk()->assertJsonCount(0, 'data');

        // Rien n'a changé pour Alice, qui garde l'accès à ses données.
        $this->assertSame(PaymentStatus::Processing, $payment->fresh()->status);
        $this->asCustomer($alice)->getJson("/api/v1/account/reservations/{$reservation->id}")->assertOk();
        $this->asCustomer($alice)->getJson("/api/v1/account/payments/{$payment->id}")->assertOk();
    }

    public function test_agency_staff_cannot_reach_another_agency_by_changing_an_identifier(): void
    {
        $manager = $this->staff(RoleName::AgencyManager, $this->agencyA);

        $vehicleB = Vehicle::factory()->for($this->agencyB)->create();
        $employeeB = $this->staff(RoleName::CounterClerk, $this->agencyB)->employeeProfile;
        $reservationB = Reservation::factory()->for($this->tripB)->create();
        $paymentB = Payment::factory()->for($reservationB)->create();

        $refused = [
            ['GET', "/api/v1/agency/trips/{$this->tripB->id}"],
            ['PATCH', "/api/v1/agency/trips/{$this->tripB->id}"],
            ['DELETE', "/api/v1/agency/trips/{$this->tripB->id}"],
            ['POST', "/api/v1/agency/trips/{$this->tripB->id}/cancel"],
            ['GET', "/api/v1/agency/vehicles/{$vehicleB->id}"],
            ['PATCH', "/api/v1/agency/vehicles/{$vehicleB->id}"],
            ['DELETE', "/api/v1/agency/vehicles/{$vehicleB->id}"],
            ['GET', "/api/v1/agency/employees/{$employeeB->id}"],
            ['PATCH', "/api/v1/agency/employees/{$employeeB->id}"],
            ['GET', "/api/v1/agency/reservations/{$reservationB->id}"],
            ['POST', "/api/v1/agency/reservations/{$reservationB->id}/cancel"],
            ['GET', "/api/v1/agency/payments/{$paymentB->id}"],
            ['GET', "/api/v1/agency/agencies/{$this->agencyB->id}"],
            ['PATCH', "/api/v1/agency/agencies/{$this->agencyB->id}/settings"],
            ['GET', "/api/v1/agency/organizations/{$this->agencyB->organization_id}"],
            ['GET', "/api/v1/agency/dashboard?agency_id={$this->agencyB->id}"],
            // Créer une ressource dans une autre agence en forçant agency_id.
            ['POST', '/api/v1/agency/vehicles', ['agency_id' => $this->agencyB->id]],
            ['POST', '/api/v1/agency/trips', ['agency_id' => $this->agencyB->id]],
            ['POST', '/api/v1/agency/employees', ['agency_id' => $this->agencyB->id]],
        ];

        foreach ($refused as $request) {
            [$method, $uri, $body] = $request + [2 => []];
            $status = $this->asAgency($manager)->json($method, $uri, $body)->status();
            $this->assertSame(403, $status, "$method $uri");
        }

        // Les listes ne contiennent que les données de son agence.
        $this->asAgency($manager)->getJson('/api/v1/agency/trips')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $this->tripA->id);
        $this->asAgency($manager)->getJson('/api/v1/agency/reservations')->assertOk()->assertJsonCount(0, 'data');
        $this->asAgency($manager)->getJson('/api/v1/agency/payments')->assertOk()->assertJsonCount(0, 'data');

        // Ses propres ressources restent accessibles.
        $this->asAgency($manager)->getJson("/api/v1/agency/trips/{$this->tripA->id}")->assertOk();
        $this->asAgency($manager)->getJson("/api/v1/agency/dashboard?agency_id={$this->agencyA->id}")->assertOk();
    }

    public function test_a_director_is_confined_to_their_organization(): void
    {
        $director = $this->director($this->agencyA->organization);

        $this->asAgency($director)->getJson("/api/v1/agency/organizations/{$this->agencyB->organization_id}")->assertForbidden();
        $this->asAgency($director)->patchJson("/api/v1/agency/organizations/{$this->agencyB->organization_id}", ['name' => 'Piratée'])->assertForbidden();
        $this->asAgency($director)->getJson("/api/v1/agency/agencies/{$this->agencyB->id}")->assertForbidden();
        $this->asAgency($director)->patchJson("/api/v1/agency/agencies/{$this->agencyB->id}", ['name' => 'Piratée'])->assertForbidden();
        $this->asAgency($director)->getJson("/api/v1/agency/trips/{$this->tripB->id}")->assertForbidden();

        $this->assertNotSame('Piratée', $this->agencyB->fresh()->name);
        $this->asAgency($director)->getJson("/api/v1/agency/organizations/{$this->agencyA->organization_id}")->assertOk();
        $this->asAgency($director)->getJson('/api/v1/agency/agencies')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $this->agencyA->id);
    }

    public function test_staff_without_the_permission_are_refused_in_their_own_agency(): void
    {
        $driver = $this->staff(RoleName::Driver, $this->agencyA);
        $clerk = $this->staff(RoleName::CounterClerk, $this->agencyA);
        $accountant = $this->staff(RoleName::Accountant, $this->agencyA);

        $reservation = Reservation::factory()->for($this->tripA)->create();
        $payment = Payment::factory()->for($reservation)->create(['status' => PaymentStatus::Paid, 'paid_at' => now()]);

        $this->asAgency($driver)->postJson('/api/v1/agency/vehicles', [])->assertForbidden();
        $this->asAgency($driver)->getJson('/api/v1/agency/reservations')->assertForbidden();
        $this->asAgency($driver)->getJson('/api/v1/agency/employees')->assertForbidden();
        $this->asAgency($clerk)->postJson("/api/v1/agency/payments/{$payment->id}/refund")->assertForbidden();
        $this->asAgency($clerk)->postJson("/api/v1/agency/trips/{$this->tripA->id}/cancel")->assertForbidden();
        $this->asAgency($accountant)->postJson("/api/v1/agency/reservations/{$reservation->id}/cancel")->assertForbidden();
        $this->asAgency($accountant)->postJson('/api/v1/agency/employees', [])->assertForbidden();

        $this->assertSame(PaymentStatus::Paid, $payment->fresh()->status);

        // Ce que leur rôle autorise fonctionne toujours.
        $this->asAgency($driver)->getJson('/api/v1/agency/vehicles')->assertOk();
        $this->asAgency($clerk)->getJson("/api/v1/agency/reservations/{$reservation->id}")->assertOk();
        $this->asAgency($accountant)->getJson("/api/v1/agency/payments/{$payment->id}")->assertOk();
    }

    public function test_a_suspended_account_loses_access_with_its_existing_token(): void
    {
        $manager = $this->staff(RoleName::AgencyManager, $this->agencyA);
        $this->asAgency($manager)->getJson('/api/v1/auth/me')->assertOk();

        EmployeeProfile::query()->where('user_id', $manager->id)->update(['status' => EmployeeStatus::Suspended]);
        $this->app['auth']->forgetGuards();

        $this->getJson('/api/v1/agency/trips')->assertForbidden()->assertJsonPath('message', 'Votre accès est désactivé.');
        $this->assertSame(0, $manager->tokens()->count());
    }
}
