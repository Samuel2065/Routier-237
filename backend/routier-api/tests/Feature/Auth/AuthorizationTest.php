<?php

namespace Tests\Feature\Auth;

use App\Enums\PermissionName;
use App\Enums\RoleName;
use App\Models\Agency;
use App\Models\EmployeeProfile;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Trip;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Spatie\Permission\Models\Role;
use Tests\Concerns\CreatesUsers;
use Tests\TestCase;

/**
 * Permissions + périmètre : isolation organisation/agence (critères A9, A10, A11).
 */
class AuthorizationTest extends TestCase
{
    use CreatesUsers, RefreshDatabase;

    private Organization $orgA;

    private Agency $agencyA1;

    private Agency $agencyA2;

    private Agency $agencyB1;

    private Trip $tripA1;

    private Trip $tripA2;

    private Trip $tripB1;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRoles();

        // Organisation A (deux agences) et organisation B (une agence).
        $this->orgA = Organization::factory()->create();
        $this->agencyA1 = Agency::factory()->for($this->orgA)->create();
        $this->agencyA2 = Agency::factory()->for($this->orgA)->create();
        $this->agencyB1 = Agency::factory()->create();

        $this->tripA1 = Trip::factory()->for($this->agencyA1)->create();
        $this->tripA2 = Trip::factory()->for($this->agencyA2)->create();
        $this->tripB1 = Trip::factory()->for($this->agencyB1)->create();
    }

    public function test_role_permission_matrix(): void
    {
        $this->assertEqualsCanonicalizing(
            PermissionName::values(),
            Role::findByName('super_admin')->permissions->pluck('name')->all(),
        );
        $this->assertCount(0, Role::findByName('customer')->permissions);

        $driver = Role::findByName('driver');
        $this->assertTrue($driver->hasPermissionTo('trips.view'));
        $this->assertFalse($driver->hasPermissionTo('trips.update'));
        $this->assertFalse($driver->hasPermissionTo('employees.view'));

        $this->assertFalse(Role::findByName('counter_clerk')->hasPermissionTo('payments.refund'));
        $this->assertTrue(Role::findByName('accountant')->hasPermissionTo('payments.refund'));
        $this->assertFalse(Role::findByName('agency_manager')->hasPermissionTo('agencies.create'));
        $this->assertTrue(Role::findByName('director')->hasPermissionTo('agencies.create'));
        $this->assertFalse(Role::findByName('director')->hasPermissionTo('organizations.create'));
    }

    public function test_agency_manager_is_confined_to_their_agency(): void
    {
        $manager = $this->staff(RoleName::AgencyManager, $this->agencyA1);

        $this->assertTrue(Gate::forUser($manager)->allows('update', $this->tripA1));
        $this->assertTrue(Gate::forUser($manager)->allows('publish', $this->tripA1));
        $this->assertTrue(Gate::forUser($manager)->allows('create', [Trip::class, $this->agencyA1]));

        // Autre agence de la même organisation, et autre organisation : refus.
        foreach ([$this->tripA2, $this->tripB1] as $foreignTrip) {
            $this->assertFalse(Gate::forUser($manager)->allows('view', $foreignTrip));
            $this->assertFalse(Gate::forUser($manager)->allows('update', $foreignTrip));
            $this->assertFalse(Gate::forUser($manager)->allows('update', $foreignTrip->vehicle));
        }
        $this->assertFalse(Gate::forUser($manager)->allows('create', [Trip::class, $this->agencyA2]));
        $this->assertFalse(Gate::forUser($manager)->allows('create', [Vehicle::class, $this->agencyB1]));

        $this->assertEqualsCanonicalizing([$this->tripA1->id], Trip::accessibleBy($manager)->pluck('id')->all());
        $this->assertEqualsCanonicalizing([$this->agencyA1->id], Agency::accessibleBy($manager)->pluck('id')->all());
    }

    public function test_director_manages_every_agency_of_their_organization_only(): void
    {
        $director = $this->director($this->orgA);

        $this->assertTrue(Gate::forUser($director)->allows('update', $this->tripA1));
        $this->assertTrue(Gate::forUser($director)->allows('update', $this->tripA2));
        $this->assertFalse(Gate::forUser($director)->allows('view', $this->tripB1));

        $this->assertTrue(Gate::forUser($director)->allows('create', [Agency::class, $this->orgA]));
        $this->assertFalse(Gate::forUser($director)->allows('create', [Agency::class, $this->agencyB1->organization]));
        $this->assertTrue(Gate::forUser($director)->allows('update', $this->orgA));
        $this->assertFalse(Gate::forUser($director)->allows('update', $this->agencyB1->organization));
        $this->assertFalse(Gate::forUser($director)->allows('viewAny', Organization::class));

        $this->assertEqualsCanonicalizing(
            [$this->tripA1->id, $this->tripA2->id],
            Trip::accessibleBy($director)->pluck('id')->all(),
        );
    }

    public function test_limited_roles_only_get_their_permissions(): void
    {
        $clerk = $this->staff(RoleName::CounterClerk, $this->agencyA1);
        $accountant = $this->staff(RoleName::Accountant, $this->agencyA1);
        $driver = $this->staff(RoleName::Driver, $this->agencyA1);

        $reservation = Reservation::factory()->for($this->tripA1)->create();
        $payment = Payment::factory()->for($reservation)->create();

        $this->assertTrue(Gate::forUser($clerk)->allows('view', $reservation));
        $this->assertTrue(Gate::forUser($clerk)->allows('cancel', $reservation));
        $this->assertFalse(Gate::forUser($clerk)->allows('update', $this->tripA1));
        $this->assertFalse(Gate::forUser($clerk)->allows('refund', $payment));

        $this->assertTrue(Gate::forUser($accountant)->allows('refund', $payment));
        $this->assertFalse(Gate::forUser($accountant)->allows('cancel', $reservation));

        $this->assertTrue(Gate::forUser($driver)->allows('view', $this->tripA1));
        $this->assertFalse(Gate::forUser($driver)->allows('update', $this->tripA1));
        $this->assertFalse(Gate::forUser($driver)->allows('view', $reservation));
        $this->assertFalse(Gate::forUser($driver)->allows('viewAny', EmployeeProfile::class));
    }

    public function test_staff_cannot_reach_reservations_or_payments_of_another_agency(): void
    {
        $clerkA1 = $this->staff(RoleName::CounterClerk, $this->agencyA1);
        $accountantA1 = $this->staff(RoleName::Accountant, $this->agencyA1);

        $foreignReservation = Reservation::factory()->for($this->tripB1)->create();
        $foreignPayment = Payment::factory()->for($foreignReservation)->create();
        $ownReservation = Reservation::factory()->for($this->tripA1)->create();

        $this->assertFalse(Gate::forUser($clerkA1)->allows('view', $foreignReservation));
        $this->assertFalse(Gate::forUser($clerkA1)->allows('cancel', $foreignReservation));
        $this->assertFalse(Gate::forUser($accountantA1)->allows('view', $foreignPayment));
        $this->assertFalse(Gate::forUser($accountantA1)->allows('refund', $foreignPayment));

        $this->assertSame([$ownReservation->id], Reservation::accessibleBy($clerkA1)->pluck('id')->all());
        $this->assertSame([], Payment::accessibleBy($accountantA1)->pluck('id')->all());
    }

    public function test_customer_only_sees_their_own_reservations(): void
    {
        $alice = $this->customer();
        $bob = $this->customer();

        $aliceReservation = Reservation::factory()->for($this->tripA1)->for($alice)->create();
        $bobReservation = Reservation::factory()->for($this->tripA1)->for($bob)->create();
        $alicePayment = Payment::factory()->for($aliceReservation)->create();
        $bobPayment = Payment::factory()->for($bobReservation)->create();

        $this->assertTrue(Gate::forUser($alice)->allows('view', $aliceReservation));
        $this->assertTrue(Gate::forUser($alice)->allows('cancel', $aliceReservation));
        $this->assertTrue(Gate::forUser($alice)->allows('create', Reservation::class));
        $this->assertTrue(Gate::forUser($alice)->allows('view', $alicePayment));
        $this->assertTrue(Gate::forUser($alice)->allows('create', [Payment::class, $aliceReservation]));

        $this->assertFalse(Gate::forUser($alice)->allows('view', $bobReservation));
        $this->assertFalse(Gate::forUser($alice)->allows('cancel', $bobReservation));
        $this->assertFalse(Gate::forUser($alice)->allows('view', $bobPayment));
        $this->assertFalse(Gate::forUser($alice)->allows('create', [Payment::class, $bobReservation]));
        $this->assertFalse(Gate::forUser($alice)->allows('refund', $alicePayment));

        // Aucun accès aux fonctions de gestion.
        $this->assertFalse(Gate::forUser($alice)->allows('view', $this->tripA1));
        $this->assertFalse(Gate::forUser($alice)->allows('viewAny', Vehicle::class));

        $this->assertSame([$aliceReservation->id], Reservation::accessibleBy($alice)->pluck('id')->all());
        $this->assertSame([$alicePayment->id], Payment::accessibleBy($alice)->pluck('id')->all());
    }

    public function test_staff_cannot_book_as_customer(): void
    {
        $manager = $this->staff(RoleName::AgencyManager, $this->agencyA1);

        $this->assertFalse(Gate::forUser($manager)->allows('create', Reservation::class));
    }

    public function test_employee_management_prevents_privilege_escalation(): void
    {
        $manager = $this->staff(RoleName::AgencyManager, $this->agencyA1);
        $clerk = $this->staff(RoleName::CounterClerk, $this->agencyA1)->employeeProfile;
        $otherManager = $this->staff(RoleName::AgencyManager, $this->agencyA1)->employeeProfile;
        $foreignClerk = $this->staff(RoleName::CounterClerk, $this->agencyA2)->employeeProfile;

        $this->assertTrue(Gate::forUser($manager)->allows('update', $clerk));
        $this->assertFalse(Gate::forUser($manager)->allows('update', $otherManager));
        $this->assertFalse(Gate::forUser($manager)->allows('update', $manager->employeeProfile));
        $this->assertFalse(Gate::forUser($manager)->allows('update', $foreignClerk));
        $this->assertFalse(Gate::forUser($manager)->allows('create', [EmployeeProfile::class, $this->agencyA2]));

        $director = $this->director($this->orgA);
        $this->assertTrue(Gate::forUser($director)->allows('update', $otherManager));
        $this->assertTrue(Gate::forUser($director)->allows('update', $foreignClerk));

        $this->assertSame(
            [RoleName::CounterClerk, RoleName::Accountant, RoleName::Driver],
            $manager->assignableRoles(),
        );
    }

    public function test_super_admin_supervises_the_whole_platform(): void
    {
        $admin = $this->superAdmin();

        $this->assertTrue(Gate::forUser($admin)->allows('viewAny', Organization::class));
        $this->assertTrue(Gate::forUser($admin)->allows('create', Organization::class));
        $this->assertTrue(Gate::forUser($admin)->allows('view', $this->tripB1));
        $this->assertTrue(Gate::forUser($admin)->allows('viewAny', User::class));
        $this->assertFalse(Gate::forUser($admin)->allows('update', $admin), 'Pas de modification de son propre compte.');
        $this->assertSame(3, Trip::accessibleBy($admin)->count());

        $director = $this->director($this->orgA);
        $this->assertFalse(Gate::forUser($director)->allows('viewAny', User::class));
        $this->assertFalse(Gate::forUser($director)->allows('create', Organization::class));
    }
}
