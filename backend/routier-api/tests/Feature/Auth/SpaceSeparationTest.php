<?php

namespace Tests\Feature\Auth;

use App\Enums\RoleName;
use App\Models\Agency;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\Concerns\CreatesUsers;
use Tests\TestCase;

/**
 * Un jeton émis pour un espace ne donne jamais accès aux routes d'un autre espace.
 */
class SpaceSeparationTest extends TestCase
{
    use CreatesUsers, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRoles();

        // Routes de test protégées exactement comme les groupes de routes/api.php.
        foreach (['customer', 'agency', 'admin'] as $space) {
            Route::middleware(['api', 'auth:sanctum', "space:$space"])
                ->get("/api/test-space/$space", fn () => ['space' => $space]);
        }
    }

    public function test_tokens_only_open_their_own_space(): void
    {
        $agency = Agency::factory()->create();

        $tokens = [
            'customer' => $this->token('/api/v1/auth/login', $this->customer()),
            'agency' => $this->token('/api/v1/agency/auth/login', $this->staff(RoleName::AgencyManager, $agency)),
            'admin' => $this->token('/api/v1/admin/auth/login', $this->superAdmin()),
        ];

        foreach ($tokens as $tokenSpace => $token) {
            foreach (['customer', 'agency', 'admin'] as $routeSpace) {
                $this->app['auth']->forgetGuards();

                $response = $this->withToken($token)->getJson("/api/test-space/$routeSpace");

                $tokenSpace === $routeSpace
                    ? $response->assertOk()->assertJson(['space' => $routeSpace])
                    : $response->assertForbidden();
            }
        }
    }

    public function test_default_refusal_messages_are_in_french(): void
    {
        $driver = $this->staff(RoleName::Driver, Agency::factory()->create());
        $token = $this->token('/api/v1/agency/auth/login', $driver);

        $this->withToken($token)->getJson('/api/v1/agency/agencies')
            ->assertForbidden()
            ->assertExactJson(['message' => "Vous n'êtes pas autorisé à effectuer cette action."]);

        $this->app['auth']->forgetGuards();
        $this->withoutToken()->getJson('/api/v1/auth/me')->assertUnauthorized()->assertExactJson(['message' => 'Authentification requise.']);
    }

    public function test_guests_cannot_open_private_spaces(): void
    {
        foreach (['customer', 'agency', 'admin'] as $space) {
            $this->getJson("/api/test-space/$space")->assertUnauthorized();
        }
    }

    private function token(string $url, User $user): string
    {
        return $this->postJson($url, ['email' => $user->email, 'password' => 'password'])
            ->assertOk()
            ->json('data.token');
    }
}
