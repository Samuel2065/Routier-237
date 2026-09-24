<?php

namespace Tests\Feature\Admin;

use App\Enums\PaymentStatus;
use App\Enums\RecordStatus;
use App\Enums\ReservationStatus;
use App\Enums\RoleName;
use App\Enums\TripStatus;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Trip;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\Concerns\AuthenticatesInSpace;
use Tests\Concerns\CreatesUsers;
use Tests\TestCase;

/**
 * Supervision de la plateforme : tableau de bord et contrôle des comptes (/admin/*).
 */
class AdminSupervisionTest extends TestCase
{
    use AuthenticatesInSpace, CreatesUsers, RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRoles();
        $this->admin = $this->superAdmin();
    }

    public function test_dashboard_gives_platform_wide_figures(): void
    {
        Organization::factory()->create(['status' => RecordStatus::Inactive]);
        $agency = Agency::factory()->create();
        Agency::factory()->create(['status' => RecordStatus::Inactive]);
        $this->staff(RoleName::AgencyManager, $agency);
        $customer = $this->customer();
        $trip = Trip::factory()->for($agency)->create(['departure_date' => now()->addDay()->toDateString(), 'status' => TripStatus::Published]);
        $confirmed = Reservation::factory()->for($trip)->for($customer)->create(['confirmed_at' => now()]);
        Payment::factory()->for($confirmed)->create(['amount' => 7000, 'status' => PaymentStatus::Paid, 'paid_at' => now(), 'provider' => 'mock']);
        $cancelled = Reservation::factory()->for($trip)->create(['status' => ReservationStatus::Cancelled]);
        Payment::factory()->for($cancelled)->create(['amount' => 5000, 'status' => PaymentStatus::Paid, 'paid_at' => now(), 'provider' => 'mock']);

        $this->asAdmin($this->admin)->getJson('/api/v1/admin/dashboard')
            ->assertOk()
            ->assertJsonPath('data.organizations.inactive', 1)
            ->assertJsonPath('data.agencies.active', 1)
            ->assertJsonPath('data.agencies.inactive', 1)
            ->assertJsonPath('data.users.customers', 1)
            ->assertJsonPath('data.users.staff', 1)
            ->assertJsonPath('data.trips.published_next_7_days', 1)
            ->assertJsonPath('data.reservations.confirmed_last_30_days', 1)
            ->assertJsonPath('data.payments.paid_this_month_amount', 12000)
            ->assertJsonPath('data.payments.requires_refund', 1);
    }

    public function test_admin_lists_and_filters_users(): void
    {
        $organization = Organization::factory()->create();
        $agency = Agency::factory()->for($organization)->create();
        $director = $this->director($organization);
        $clerk = $this->staff(RoleName::CounterClerk, $agency);
        $customer = $this->customer();
        $customer->forceFill(['name' => 'Awa Nkoulou'])->save();

        $this->asAdmin($this->admin)->getJson('/api/v1/admin/users')
            ->assertOk()
            ->assertJsonPath('meta.total', 4);

        $this->asAdmin($this->admin)->getJson('/api/v1/admin/users?role=customer&search=awa')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $customer->id)
            ->assertJsonPath('data.0.role', 'customer')
            ->assertJsonMissingPath('data.0.permissions');

        $this->asAdmin($this->admin)->getJson("/api/v1/admin/users?organization_id={$organization->id}")
            ->assertJsonPath('meta.total', 2);

        $this->asAdmin($this->admin)->getJson("/api/v1/admin/users/{$clerk->id}")
            ->assertOk()
            ->assertJsonPath('data.agency.id', $agency->id)
            ->assertJsonPath('data.organization.id', $organization->id);

        $this->asAdmin($this->admin)->getJson("/api/v1/admin/users/{$director->id}")
            ->assertJsonPath('data.organization.id', $organization->id)
            ->assertJsonPath('data.agency', null);
    }

    public function test_suspending_an_account_revokes_its_access(): void
    {
        $customer = $this->customer();
        $customer->createToken('customer', ['space:customer']);

        $this->asAdmin($this->admin)->patchJson("/api/v1/admin/users/{$customer->id}", ['status' => 'suspended'])
            ->assertOk()
            ->assertJsonPath('data.status', 'suspended');

        $this->assertSame(0, PersonalAccessToken::where('tokenable_id', $customer->id)->count());
        $this->app['auth']->forgetGuards();
        $this->withoutToken()->postJson('/api/v1/auth/login', ['email' => $customer->email, 'password' => 'password'])->assertUnprocessable();

        $this->asAdmin($this->admin)->patchJson("/api/v1/admin/users/{$customer->id}", ['status' => 'active'])
            ->assertOk();
        $this->assertSame(UserStatus::Active, $customer->fresh()->status);

        // Pas d'auto-suspension ; statut invalide refusé.
        $this->asAdmin($this->admin)->patchJson("/api/v1/admin/users/{$this->admin->id}", ['status' => 'suspended'])->assertForbidden();
        $this->asAdmin($this->admin)->patchJson("/api/v1/admin/users/{$customer->id}", ['status' => 'deleted'])->assertUnprocessable();
    }

    public function test_supervision_is_reserved_to_the_platform(): void
    {
        $director = $this->director(Organization::factory()->create());

        $this->asAgency($director)->getJson('/api/v1/admin/dashboard')->assertForbidden();
        $this->asAgency($director)->getJson('/api/v1/admin/users')->assertForbidden();
    }
}
