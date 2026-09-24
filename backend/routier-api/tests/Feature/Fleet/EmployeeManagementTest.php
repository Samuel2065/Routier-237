<?php

namespace Tests\Feature\Fleet;

use App\Enums\RecordStatus;
use App\Enums\RoleName;
use App\Models\Agency;
use App\Models\EmployeeProfile;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\Concerns\AuthenticatesInSpace;
use Tests\Concerns\CreatesUsers;
use Tests\TestCase;

class EmployeeManagementTest extends TestCase
{
    use AuthenticatesInSpace, CreatesUsers, RefreshDatabase;

    private Agency $agency;

    private Agency $sibling;

    private Agency $foreign;

    private User $manager;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRoles();

        $organization = Organization::factory()->create();
        $this->agency = Agency::factory()->for($organization)->create();
        $this->sibling = Agency::factory()->for($organization)->create();
        $this->foreign = Agency::factory()->create();
        $this->manager = $this->staff(RoleName::AgencyManager, $this->agency);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'role' => 'counter_clerk',
            'name' => 'Guichetière Test',
            'email' => 'guichet@example.test',
            'phone' => '699 11 22 33',
            'password' => 'Initial123',
            'employee_number' => 'bta-010',
            'hired_at' => '2026-02-01',
        ], $overrides);
    }

    public function test_manager_hires_a_counter_clerk_who_can_log_in(): void
    {
        $this->asAgency($this->manager)->postJson('/api/v1/agency/employees', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.role', 'counter_clerk')
            ->assertJsonPath('data.agency.id', $this->agency->id)
            ->assertJsonPath('data.employee_number', 'BTA-010')
            ->assertJsonPath('data.user.phone', '699112233')
            ->assertJsonPath('data.driver_profile', null);

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/agency/auth/login', ['email' => 'guichet@example.test', 'password' => 'Initial123'])
            ->assertOk()
            ->assertJsonPath('data.user.agency.id', $this->agency->id);

        // Matricule unique dans l'agence.
        $this->asAgency($this->manager)->postJson('/api/v1/agency/employees', $this->payload([
            'email' => 'autre@example.test', 'phone' => null,
        ]))->assertUnprocessable()->assertJsonValidationErrors('employee_number');
    }

    public function test_a_driver_requires_a_valid_license(): void
    {
        $this->asAgency($this->manager)->postJson('/api/v1/agency/employees', $this->payload(['role' => 'driver']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['license_number', 'license_expires_at']);

        $this->asAgency($this->manager)->postJson('/api/v1/agency/employees', $this->payload([
            'role' => 'driver',
            'license_number' => 'cm-123456',
            'license_expires_at' => now()->subDay()->toDateString(),
        ]))->assertUnprocessable()->assertJsonValidationErrors('license_expires_at');

        $this->asAgency($this->manager)->postJson('/api/v1/agency/employees', $this->payload([
            'role' => 'driver',
            'license_number' => 'cm-123456',
            'license_expires_at' => now()->addYear()->toDateString(),
        ]))->assertCreated()
            ->assertJsonPath('data.role', 'driver')
            ->assertJsonPath('data.driver_profile.license_number', 'CM-123456')
            ->assertJsonPath('data.driver_profile.license_expired', false);

        // Un permis n'a pas de sens pour un autre rôle.
        $this->asAgency($this->manager)->postJson('/api/v1/agency/employees', $this->payload([
            'email' => 'x@example.test', 'phone' => null, 'employee_number' => 'BTA-011',
            'license_number' => 'CM-999',
        ]))->assertUnprocessable()->assertJsonValidationErrors('license_number');

        $this->asAgency($this->manager)->getJson('/api/v1/agency/employees?role=driver')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.driver_profile.license_number', 'CM-123456');
    }

    public function test_no_privilege_escalation_when_hiring(): void
    {
        foreach (['agency_manager', 'director', 'super_admin', 'customer'] as $role) {
            $this->asAgency($this->manager)->postJson('/api/v1/agency/employees', $this->payload(['role' => $role]))
                ->assertUnprocessable()
                ->assertJsonValidationErrors('role');
        }

        // Le director peut nommer un responsable, dans une agence de son organisation.
        $director = $this->director($this->agency->organization);
        $this->asAgency($director)->postJson('/api/v1/agency/employees', $this->payload([
            'role' => 'agency_manager', 'agency_id' => $this->sibling->id,
        ]))->assertCreated()->assertJsonPath('data.agency.id', $this->sibling->id);
    }

    public function test_hiring_is_limited_to_the_accessible_agencies(): void
    {
        $this->asAgency($this->manager)->postJson('/api/v1/agency/employees', $this->payload(['agency_id' => $this->sibling->id]))
            ->assertForbidden();

        $director = $this->director($this->agency->organization);
        $this->asAgency($director)->postJson('/api/v1/agency/employees', $this->payload(['agency_id' => $this->foreign->id]))
            ->assertForbidden();
        $this->asAgency($director)->postJson('/api/v1/agency/employees', $this->payload())
            ->assertUnprocessable()->assertJsonValidationErrors('agency_id');

        $this->assertSame(0, User::where('email', 'guichet@example.test')->count());
    }

    public function test_listing_and_viewing_are_isolated(): void
    {
        $colleague = $this->staff(RoleName::CounterClerk, $this->agency)->employeeProfile;
        $foreignEmployee = $this->staff(RoleName::CounterClerk, $this->foreign)->employeeProfile;
        $this->staff(RoleName::Accountant, $this->sibling);

        $this->asAgency($this->manager)->getJson('/api/v1/agency/employees')
            ->assertOk()
            ->assertJsonPath('meta.total', 2); // lui-même + le guichetier

        $this->asAgency($this->manager)->getJson("/api/v1/agency/employees/{$colleague->id}")->assertOk();
        $this->asAgency($this->manager)->getJson("/api/v1/agency/employees/{$foreignEmployee->id}")->assertForbidden();

        $director = $this->director($this->agency->organization);
        $this->asAgency($director)->getJson('/api/v1/agency/employees')->assertJsonPath('meta.total', 3);

        $clerk = $colleague->user;
        $this->asAgency($clerk)->getJson('/api/v1/agency/employees')->assertForbidden();
    }

    public function test_manager_updates_and_offboards_staff(): void
    {
        $clerk = $this->staff(RoleName::CounterClerk, $this->agency);
        $employee = $clerk->employeeProfile;
        $clerkToken = $clerk->createToken('agency', ['space:agency'])->plainTextToken;

        // Changement de rôle vers conducteur : permis obligatoire.
        $this->asAgency($this->manager)->patchJson("/api/v1/agency/employees/{$employee->id}", ['role' => 'driver'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['license_number', 'license_expires_at']);

        $this->asAgency($this->manager)->patchJson("/api/v1/agency/employees/{$employee->id}", [
            'role' => 'driver',
            'license_number' => 'CM-777',
            'license_expires_at' => now()->addYears(2)->toDateString(),
        ])->assertOk()
            ->assertJsonPath('data.role', 'driver')
            ->assertJsonPath('data.driver_profile.status', 'active');

        // Retour au guichet : profil conducteur conservé mais désactivé.
        $this->asAgency($this->manager)->patchJson("/api/v1/agency/employees/{$employee->id}", ['role' => 'counter_clerk'])
            ->assertOk()
            ->assertJsonPath('data.driver_profile.status', 'inactive');
        $this->assertSame(RecordStatus::Inactive, $employee->driverProfile()->first()->status);

        // Départ : statut terminated, jetons révoqués, connexion impossible.
        $this->asAgency($this->manager)->patchJson("/api/v1/agency/employees/{$employee->id}", ['status' => 'terminated'])
            ->assertOk()
            ->assertJsonPath('data.status', 'terminated');

        $this->assertSame(0, PersonalAccessToken::where('tokenable_id', $clerk->id)->count());
        $this->app['auth']->forgetGuards();
        $this->withToken($clerkToken)->getJson('/api/v1/auth/me')->assertUnauthorized();
        $this->postJson('/api/v1/agency/auth/login', ['email' => $clerk->email, 'password' => 'password'])
            ->assertUnprocessable();
    }

    public function test_manager_cannot_modify_peers_or_superiors(): void
    {
        $otherManager = $this->staff(RoleName::AgencyManager, $this->agency)->employeeProfile;
        $clerk = $this->staff(RoleName::CounterClerk, $this->agency)->employeeProfile;

        $this->asAgency($this->manager)->patchJson("/api/v1/agency/employees/{$otherManager->id}", ['status' => 'suspended'])
            ->assertForbidden();
        $this->asAgency($this->manager)->patchJson("/api/v1/agency/employees/{$this->manager->employeeProfile->id}", ['role' => 'counter_clerk'])
            ->assertForbidden();
        $this->asAgency($this->manager)->patchJson("/api/v1/agency/employees/{$clerk->id}", ['role' => 'agency_manager'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('role');
        $this->asAgency($this->manager)->patchJson("/api/v1/agency/employees/{$clerk->id}", ['agency_id' => $this->sibling->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('agency_id');

        $this->assertSame(RoleName::CounterClerk, $clerk->user->fresh()->primaryRole());
        $this->assertSame($this->agency->id, $clerk->fresh()->agency_id);
        $this->assertSame(0, EmployeeProfile::where('agency_id', $this->sibling->id)->count());
    }
}
