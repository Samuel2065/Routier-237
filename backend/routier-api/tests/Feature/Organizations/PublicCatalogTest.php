<?php

namespace Tests\Feature\Organizations;

use App\Enums\RecordStatus;
use App\Models\Agency;
use App\Models\City;
use App\Models\Organization;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Consultation publique sans compte : villes et agences.
 */
class PublicCatalogTest extends TestCase
{
    use RefreshDatabase;

    public function test_cities_are_listed_alphabetically_without_authentication(): void
    {
        City::factory()->create(['name' => 'Yaoundé', 'slug' => 'yaounde']);
        City::factory()->create(['name' => 'Bertoua', 'slug' => 'bertoua']);

        $this->getJson('/api/v1/cities')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Bertoua')
            ->assertJsonPath('data.1.name', 'Yaoundé')
            ->assertJsonStructure(['data' => [['id', 'name', 'slug']]]);
    }

    public function test_only_active_agencies_of_active_organizations_are_public(): void
    {
        $visible = Agency::factory()->create(['name' => 'Agence Visible']);
        Agency::factory()->create(['name' => 'Agence Fermée', 'status' => RecordStatus::Inactive]);
        $suspendedOrg = Organization::factory()->create(['status' => RecordStatus::Inactive]);
        $hidden = Agency::factory()->for($suspendedOrg)->create(['name' => 'Agence Orga Suspendue']);

        $this->getJson('/api/v1/agencies')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $visible->id)
            ->assertJsonPath('data.0.organization.name', $visible->organization->name)
            ->assertJsonMissingPath('data.0.status');

        $this->getJson("/api/v1/agencies/{$visible->id}")
            ->assertOk()
            ->assertJsonPath('data.name', 'Agence Visible')
            ->assertJsonPath('data.city.id', $visible->city_id);

        $this->getJson("/api/v1/agencies/{$hidden->id}")->assertNotFound();
        $this->getJson('/api/v1/agencies/999999')->assertNotFound();
    }

    public function test_public_agencies_can_be_filtered_by_city_and_name(): void
    {
        $bertoua = City::factory()->create();
        Agency::factory()->for($bertoua)->create(['name' => 'Agence Centre']);
        Agency::factory()->for($bertoua)->create(['name' => 'Agence Gare']);
        Agency::factory()->create(['name' => 'Agence Centre Ailleurs']);

        $this->getJson("/api/v1/agencies?city_id={$bertoua->id}")->assertJsonCount(2, 'data');
        $this->getJson("/api/v1/agencies?city_id={$bertoua->id}&search=gare")
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Agence Gare');

        // Les jokers SQL saisis par l'utilisateur ne sont pas interprétés.
        $this->getJson('/api/v1/agencies?search=%25')->assertJsonCount(0, 'data');
    }
}
