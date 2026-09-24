<?php

namespace Tests\Feature\Trips;

use App\Enums\RecordStatus;
use App\Enums\RoleName;
use App\Models\Agency;
use App\Models\City;
use App\Models\TravelRoute;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\AuthenticatesInSpace;
use Tests\Concerns\CreatesUsers;
use Tests\TestCase;

class RouteManagementTest extends TestCase
{
    use AuthenticatesInSpace, CreatesUsers, RefreshDatabase;

    public function test_agencies_consult_and_create_shared_routes(): void
    {
        $this->seedRoles();
        $manager = $this->staff(RoleName::AgencyManager, Agency::factory()->create());
        $bertoua = City::factory()->create();
        $yaounde = City::factory()->create();
        TravelRoute::factory()->create();

        $this->asAgency($manager)->getJson('/api/v1/agency/routes')->assertOk()->assertJsonCount(1, 'data');

        $this->asAgency($manager)->postJson('/api/v1/agency/routes', [
            'departure_city_id' => $bertoua->id,
            'destination_city_id' => $yaounde->id,
            'estimated_duration_minutes' => 330,
            'distance_km' => 345,
        ])->assertCreated()
            ->assertJsonPath('data.departure_city.id', $bertoua->id)
            ->assertJsonPath('data.status', 'active');

        // Même paire : refus ; sens inverse : autorisé ; même ville : refus.
        $this->asAgency($manager)->postJson('/api/v1/agency/routes', [
            'departure_city_id' => $bertoua->id, 'destination_city_id' => $yaounde->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('destination_city_id');
        $this->asAgency($manager)->postJson('/api/v1/agency/routes', [
            'departure_city_id' => $yaounde->id, 'destination_city_id' => $bertoua->id,
        ])->assertCreated();
        $this->asAgency($manager)->postJson('/api/v1/agency/routes', [
            'departure_city_id' => $bertoua->id, 'destination_city_id' => $bertoua->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('destination_city_id');

        // Les employés sans permission d'itinéraires n'y ont pas accès.
        $clerk = $this->staff(RoleName::CounterClerk, $manager->employeeProfile->agency);
        $this->asAgency($clerk)->getJson('/api/v1/agency/routes')->assertForbidden();
    }

    public function test_only_the_platform_edits_or_deactivates_a_route(): void
    {
        $this->seedRoles();
        $route = TravelRoute::factory()->create();
        $manager = $this->staff(RoleName::AgencyManager, Agency::factory()->create());

        // Pas de modification depuis l'espace agence (route inexistante dans cet espace).
        $this->asAgency($manager)->patchJson("/api/v1/agency/routes/{$route->id}", ['status' => 'inactive'])
            ->assertNotFound();
        $this->assertSame(RecordStatus::Active, $route->fresh()->status);

        $admin = $this->superAdmin();
        $this->asAdmin($admin)->patchJson("/api/v1/admin/routes/{$route->id}", [
            'status' => 'inactive',
            'estimated_duration_minutes' => 300,
        ])->assertOk()
            ->assertJsonPath('data.status', 'inactive')
            ->assertJsonPath('data.estimated_duration_minutes', 300);

        $this->asAdmin($admin)->patchJson("/api/v1/admin/routes/{$route->id}", ['departure_city_id' => 1])
            ->assertUnprocessable();
    }
}
