<?php

namespace Tests\Feature\Organizations;

use App\Enums\RecordStatus;
use App\Enums\RoleName;
use App\Models\Agency;
use App\Models\City;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\AuthenticatesInSpace;
use Tests\Concerns\CreatesUsers;
use Tests\TestCase;

/**
 * Espace administrateur : organisations, directors, agences, villes.
 */
class AdminOrganizationTest extends TestCase
{
    use AuthenticatesInSpace, CreatesUsers, RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRoles();
        $this->admin = $this->superAdmin();
    }

    public function test_admin_creates_an_organization_with_a_unique_slug(): void
    {
        Organization::factory()->create(['slug' => 'trans-est']);

        $this->asAdmin($this->admin)->postJson('/api/v1/admin/organizations', [
            'name' => 'Trans Est',
            'email' => 'contact@trans-est.test',
            'phone' => '+237 677 00 00 00',
            'status' => 'inactive', // ignoré : une organisation créée est active
        ])->assertCreated()
            ->assertJsonPath('data.name', 'Trans Est')
            ->assertJsonPath('data.slug', 'trans-est-2')
            ->assertJsonPath('data.phone', '+237677000000')
            ->assertJsonPath('data.status', 'active');

        $this->asAdmin($this->admin)->postJson('/api/v1/admin/organizations', ['name' => 'Trans Est'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');
    }

    public function test_admin_lists_filters_and_shows_organizations(): void
    {
        $active = Organization::factory()->has(Agency::factory()->count(2))->create(['name' => 'Alpha Voyages']);
        Organization::factory()->create(['name' => 'Beta Voyages', 'status' => RecordStatus::Inactive]);

        $this->asAdmin($this->admin)->getJson('/api/v1/admin/organizations')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.total', 2);

        $this->asAdmin($this->admin)->getJson('/api/v1/admin/organizations?status=active')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.agencies_count', 2);

        $this->asAdmin($this->admin)->getJson("/api/v1/admin/organizations/{$active->id}")
            ->assertOk()
            ->assertJsonCount(2, 'data.agencies')
            ->assertJsonPath('data.directors', []);
    }

    public function test_admin_creates_a_director_who_can_then_log_in_to_the_agency_space(): void
    {
        $organization = Organization::factory()->create();

        $this->asAdmin($this->admin)->postJson("/api/v1/admin/organizations/{$organization->id}/directors", [
            'name' => 'Directrice Test',
            'email' => 'Directrice@Example.test',
            'password' => 'Initial123',
        ])->assertCreated()
            ->assertJsonPath('data.role', 'director')
            ->assertJsonPath('data.organization.id', $organization->id);

        $director = User::where('email', 'directrice@example.test')->firstOrFail();
        $this->assertTrue($director->isDirector());

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/agency/auth/login', ['email' => 'directrice@example.test', 'password' => 'Initial123'])
            ->assertOk();

        $this->asAdmin($this->admin)->getJson("/api/v1/admin/organizations/{$organization->id}")
            ->assertJsonPath('data.directors.0.email', 'directrice@example.test');
    }

    public function test_suspending_an_organization_cuts_access_for_its_staff(): void
    {
        $agency = Agency::factory()->create();
        $manager = $this->staff(RoleName::AgencyManager, $agency);

        $this->asAdmin($this->admin)->patchJson("/api/v1/admin/organizations/{$agency->organization_id}", ['status' => 'inactive'])
            ->assertOk()
            ->assertJsonPath('data.status', 'inactive');

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/agency/auth/login', ['email' => $manager->email, 'password' => 'password'])
            ->assertUnprocessable();

        $this->getJson("/api/v1/agencies/{$agency->id}")->assertNotFound();
    }

    public function test_admin_supervises_and_creates_agencies_of_any_organization(): void
    {
        $organization = Organization::factory()->create();
        $city = City::factory()->create();
        Agency::factory()->count(2)->create();

        $this->asAdmin($this->admin)->postJson('/api/v1/admin/agencies', [
            'organization_id' => $organization->id,
            'city_id' => $city->id,
            'name' => 'Agence Pilote',
        ])->assertCreated()
            ->assertJsonPath('data.organization.id', $organization->id)
            ->assertJsonPath('data.status', 'active');

        $this->asAdmin($this->admin)->postJson('/api/v1/admin/agencies', ['city_id' => $city->id, 'name' => 'Sans organisation'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('organization_id');

        $this->asAdmin($this->admin)->getJson('/api/v1/admin/agencies')->assertJsonPath('meta.total', 3);
        $this->asAdmin($this->admin)->getJson("/api/v1/admin/agencies?organization_id={$organization->id}")
            ->assertJsonCount(1, 'data');
    }

    public function test_admin_manages_the_city_referential(): void
    {
        $this->asAdmin($this->admin)->postJson('/api/v1/admin/cities', ['name' => '  Ngaoundéré '])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Ngaoundéré')
            ->assertJsonPath('data.slug', 'ngaoundere');

        $city = City::where('slug', 'ngaoundere')->firstOrFail();

        $this->asAdmin($this->admin)->patchJson("/api/v1/admin/cities/{$city->id}", ['name' => 'Ngaoundere'])
            ->assertOk()
            ->assertJsonPath('data.slug', 'ngaoundere');

        $this->asAdmin($this->admin)->postJson('/api/v1/admin/cities', ['name' => 'Ngaoundere'])
            ->assertUnprocessable();
    }

    public function test_admin_routes_are_closed_to_other_spaces(): void
    {
        $organization = Organization::factory()->create();
        $director = $this->director($organization);

        // Un director (jeton agence) n'accède pas à l'API d'administration.
        $this->asAgency($director)->getJson('/api/v1/admin/organizations')->assertForbidden();
        $this->asAgency($director)->postJson('/api/v1/admin/organizations', ['name' => 'X'])->assertForbidden();
        $this->asAgency($director)->postJson('/api/v1/admin/cities', ['name' => 'X'])->assertForbidden();

        // Même avec un jeton admin, un director n'est pas super_admin : impossible d'émettre ce jeton par login.
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/admin/auth/login', ['email' => $director->email, 'password' => 'password'])
            ->assertUnprocessable();
    }
}
