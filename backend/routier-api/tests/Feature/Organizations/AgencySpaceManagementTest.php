<?php

namespace Tests\Feature\Organizations;

use App\Enums\RoleName;
use App\Models\Agency;
use App\Models\City;
use App\Models\Organization;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\AuthenticatesInSpace;
use Tests\Concerns\CreatesUsers;
use Tests\TestCase;

/**
 * Espace agence : le director gère son organisation et ses agences,
 * le responsable d'agence les paramètres de la sienne (isolation, critère A10).
 */
class AgencySpaceManagementTest extends TestCase
{
    use AuthenticatesInSpace, CreatesUsers, RefreshDatabase;

    private Organization $organization;

    private Agency $agency;

    private Agency $sibling;

    private Agency $foreign;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRoles();

        $this->organization = Organization::factory()->create();
        $this->agency = Agency::factory()->for($this->organization)->create(['name' => 'Agence Nord']);
        $this->sibling = Agency::factory()->for($this->organization)->create(['name' => 'Agence Sud']);
        $this->foreign = Agency::factory()->create();
    }

    public function test_director_creates_agencies_in_their_own_organization_only(): void
    {
        $director = $this->director($this->organization);
        $city = City::factory()->create();

        $this->asAgency($director)->postJson('/api/v1/agency/agencies', [
            'city_id' => $city->id,
            'name' => 'Agence Gare Routière',
            'phone' => '699000000',
        ])->assertCreated()
            ->assertJsonPath('data.organization.id', $this->organization->id);

        // Impossible de viser une autre organisation.
        $this->asAgency($director)->postJson('/api/v1/agency/agencies', [
            'organization_id' => $this->foreign->organization_id,
            'city_id' => $city->id,
            'name' => 'Agence Pirate',
        ])->assertUnprocessable()->assertJsonValidationErrors('organization_id');

        // Deux agences d'une organisation dans la même ville : autorisé ; même nom : refusé.
        $this->asAgency($director)->postJson('/api/v1/agency/agencies', [
            'city_id' => $city->id,
            'name' => 'Agence Nord',
        ])->assertUnprocessable()->assertJsonValidationErrors('name');

        $this->assertSame(0, Agency::where('name', 'Agence Pirate')->count());
    }

    public function test_director_sees_and_updates_only_their_organization(): void
    {
        $director = $this->director($this->organization);

        $this->asAgency($director)->getJson('/api/v1/agency/agencies')
            ->assertOk()
            ->assertJsonPath('meta.total', 2);

        $this->asAgency($director)->patchJson("/api/v1/agency/agencies/{$this->sibling->id}", ['status' => 'inactive'])
            ->assertOk()
            ->assertJsonPath('data.status', 'inactive');

        $this->asAgency($director)->getJson("/api/v1/agency/agencies/{$this->foreign->id}")->assertForbidden();
        $this->asAgency($director)->patchJson("/api/v1/agency/agencies/{$this->foreign->id}", ['name' => 'Piratée'])->assertForbidden();
        $this->assertNotSame('Piratée', $this->foreign->fresh()->name);

        // L'organisation propriétaire d'une agence ne se change pas.
        $this->asAgency($director)->patchJson("/api/v1/agency/agencies/{$this->agency->id}", [
            'organization_id' => $this->foreign->organization_id,
        ])->assertUnprocessable();

        // Profil de son organisation : oui ; statut : non ; autre organisation : non.
        $this->asAgency($director)->patchJson("/api/v1/agency/organizations/{$this->organization->id}", ['phone' => '+237222000000'])
            ->assertOk()
            ->assertJsonPath('data.phone', '+237222000000');
        $this->asAgency($director)->patchJson("/api/v1/agency/organizations/{$this->organization->id}", ['status' => 'inactive'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');
        $this->asAgency($director)->getJson("/api/v1/agency/organizations/{$this->foreign->organization_id}")->assertForbidden();
    }

    public function test_agency_manager_is_limited_to_their_agency_settings(): void
    {
        $manager = $this->staff(RoleName::AgencyManager, $this->agency);

        $this->asAgency($manager)->getJson('/api/v1/agency/agencies')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $this->agency->id);

        $this->asAgency($manager)->patchJson("/api/v1/agency/agencies/{$this->agency->id}/settings", [
            'phone' => '677 11 22 33',
            'description' => 'Départs quotidiens vers Yaoundé.',
            'name' => 'Renommée', // hors paramètres : ignoré
            'status' => 'inactive', // hors paramètres : ignoré
        ])->assertOk()
            ->assertJsonPath('data.phone', '677112233')
            ->assertJsonPath('data.name', 'Agence Nord')
            ->assertJsonPath('data.status', 'active');

        // Pas de création ni de modification complète, pas d'accès à l'agence sœur.
        $this->asAgency($manager)->postJson('/api/v1/agency/agencies', ['city_id' => 1, 'name' => 'X'])->assertForbidden();
        $this->asAgency($manager)->patchJson("/api/v1/agency/agencies/{$this->agency->id}", ['name' => 'X'])->assertForbidden();
        $this->asAgency($manager)->patchJson("/api/v1/agency/agencies/{$this->sibling->id}/settings", ['phone' => '677000000'])->assertForbidden();
        $this->asAgency($manager)->getJson("/api/v1/agency/agencies/{$this->sibling->id}")->assertForbidden();
        $this->asAgency($manager)->getJson("/api/v1/agency/organizations/{$this->organization->id}")->assertForbidden();
    }

    public function test_roles_without_agency_permissions_are_refused(): void
    {
        $clerk = $this->staff(RoleName::CounterClerk, $this->agency);

        $this->asAgency($clerk)->getJson('/api/v1/agency/agencies')->assertForbidden();
        $this->asAgency($clerk)->patchJson("/api/v1/agency/agencies/{$this->agency->id}/settings", ['phone' => '677000000'])->assertForbidden();

        $customer = $this->customer();
        $this->asCustomer($customer)->getJson('/api/v1/agency/agencies')->assertForbidden();
    }
}
