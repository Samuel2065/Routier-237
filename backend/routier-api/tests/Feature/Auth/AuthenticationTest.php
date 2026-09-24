<?php

namespace Tests\Feature\Auth;

use App\Enums\EmployeeStatus;
use App\Enums\RecordStatus;
use App\Enums\RoleName;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\Concerns\CreatesUsers;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use CreatesUsers, RefreshDatabase;

    private const PASSWORD = 'password';

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRoles();
    }

    public function test_a_visitor_can_register_as_customer_only(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Awa Nkoulou',
            'email' => 'Awa@Example.test',
            'phone' => '+237 699 12 34 56',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
            // Tentatives d'escalade ignorées :
            'role' => 'super_admin',
            'organization_id' => 1,
            'status' => 'suspended',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.token_type', 'Bearer')
            ->assertJsonPath('data.space', 'customer')
            ->assertJsonPath('data.user.email', 'awa@example.test')
            ->assertJsonPath('data.user.phone', '+237699123456')
            ->assertJsonPath('data.user.role', 'customer')
            ->assertJsonPath('data.user.permissions', [])
            ->assertJsonPath('data.user.organization', null);

        $user = User::where('email', 'awa@example.test')->firstOrFail();
        $this->assertSame([RoleName::Customer->value], $user->getRoleNames()->all());
        $this->assertNull($user->organization_id);
        $this->assertSame(UserStatus::Active, $user->status);
        $this->assertNotNull($response->json('data.token'));
    }

    public function test_registration_is_validated(): void
    {
        User::factory()->create(['email' => 'taken@example.test']);

        $this->postJson('/api/v1/auth/register', [
            'name' => '',
            'email' => 'taken@example.test',
            'phone' => '12345',
            'password' => 'short',
            'password_confirmation' => 'different',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'email', 'phone', 'password']);
    }

    public function test_each_space_only_accepts_its_own_roles(): void
    {
        $agency = Agency::factory()->create();
        $accounts = [
            'customer' => $this->customer(),
            'director' => $this->director($agency->organization),
            'manager' => $this->staff(RoleName::AgencyManager, $agency),
            'driver' => $this->staff(RoleName::Driver, $agency),
            'admin' => $this->superAdmin(),
        ];

        $expectations = [
            '/api/v1/auth/login' => ['customer'],
            '/api/v1/agency/auth/login' => ['director', 'manager', 'driver'],
            '/api/v1/admin/auth/login' => ['admin'],
        ];

        foreach ($expectations as $url => $allowed) {
            foreach ($accounts as $key => $user) {
                $response = $this->postJson($url, ['email' => $user->email, 'password' => self::PASSWORD]);

                if (in_array($key, $allowed, true)) {
                    $response->assertOk()->assertJsonPath('data.user.id', $user->id);
                } else {
                    // Même message qu'un mauvais mot de passe : aucun indice sur l'existence du compte.
                    $response->assertUnprocessable()
                        ->assertJsonPath('errors.email.0', __('auth.failed'));
                }
            }
        }
    }

    public function test_wrong_password_is_rejected(): void
    {
        $user = $this->customer();

        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'wrong-password'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.email.0', __('auth.failed'));
    }

    public function test_inactive_accounts_cannot_log_in(): void
    {
        $suspended = $this->customer();
        $suspended->status = UserStatus::Suspended;
        $suspended->save();

        $closedAgency = Agency::factory()->create(['status' => RecordStatus::Inactive]);
        $staffOfClosedAgency = $this->staff(RoleName::CounterClerk, $closedAgency);

        $agency = Agency::factory()->create();
        $formerEmployee = $this->staff(RoleName::Accountant, $agency);
        $formerEmployee->employeeProfile->update(['status' => EmployeeStatus::Terminated]);

        $this->postJson('/api/v1/auth/login', ['email' => $suspended->email, 'password' => self::PASSWORD])
            ->assertUnprocessable();

        foreach ([$staffOfClosedAgency, $formerEmployee] as $user) {
            $this->postJson('/api/v1/agency/auth/login', ['email' => $user->email, 'password' => self::PASSWORD])
                ->assertUnprocessable();
        }
    }

    public function test_me_returns_role_permissions_and_scope(): void
    {
        $agency = Agency::factory()->create();
        $manager = $this->staff(RoleName::AgencyManager, $agency);
        $token = $this->loginToken('/api/v1/agency/auth/login', $manager);

        $this->withToken($token)->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.role', 'agency_manager')
            ->assertJsonPath('data.agency.id', $agency->id)
            ->assertJsonPath('data.organization.id', $agency->organization_id)
            ->assertJsonPath('meta.space', 'agency')
            ->assertJsonFragment(['trips.publish'])
            ->assertJsonMissing(['password']);
    }

    public function test_tokens_expire_and_are_limited_to_their_space(): void
    {
        $user = $this->customer();
        $this->loginToken('/api/v1/auth/login', $user);

        $token = PersonalAccessToken::firstOrFail();
        $this->assertSame(['space:customer'], $token->abilities);
        $this->assertNotNull($token->expires_at);
        $this->assertTrue($token->expires_at->isFuture());
    }

    public function test_logout_revokes_the_current_token(): void
    {
        $user = $this->customer();
        $token = $this->loginToken('/api/v1/auth/login', $user);

        $this->withToken($token)->postJson('/api/v1/auth/logout')->assertNoContent();

        $this->assertSame(0, PersonalAccessToken::count());

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_guests_receive_json_401(): void
    {
        $this->get('/api/v1/auth/me')
            ->assertUnauthorized()
            ->assertHeader('Content-Type', 'application/json');
    }

    public function test_a_deactivated_account_loses_access_immediately(): void
    {
        $agency = Agency::factory()->create();
        $clerk = $this->staff(RoleName::CounterClerk, $agency);
        $token = $this->loginToken('/api/v1/agency/auth/login', $clerk);

        $agency->update(['status' => RecordStatus::Inactive]);

        $this->withToken($token)->getJson('/api/v1/auth/me')->assertForbidden();
        $this->assertSame(0, PersonalAccessToken::count(), 'Le jeton doit être révoqué.');
    }

    public function test_login_attempts_are_throttled(): void
    {
        $user = $this->customer();

        foreach (range(1, 5) as $attempt) {
            $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'wrong'])
                ->assertUnprocessable();
        }

        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => self::PASSWORD])
            ->assertTooManyRequests();
    }

    private function loginToken(string $url, User $user): string
    {
        $token = $this->postJson($url, ['email' => $user->email, 'password' => self::PASSWORD])
            ->assertOk()
            ->json('data.token');

        $this->app['auth']->forgetGuards();

        return $token;
    }
}
