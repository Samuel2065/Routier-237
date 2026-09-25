<?php

namespace Tests\Feature\Security;

use App\Enums\RoleName;
use App\Models\Agency;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\AuthenticatesInSpace;
use Tests\Concerns\CreatesUsers;
use Tests\TestCase;

/**
 * Durcissement (§19) : en-têtes de sécurité, limitation des espaces authentifiés,
 * connexion non révélatrice, contrôle de configuration avant production.
 */
class HardeningTest extends TestCase
{
    use AuthenticatesInSpace, CreatesUsers, RefreshDatabase;

    public function test_api_responses_carry_security_headers(): void
    {
        $this->getJson('/api/v1/cities')
            ->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('Referrer-Policy', 'no-referrer');

        // Les réponses d'erreur aussi.
        $this->getJson('/api/v1/trips/999999')->assertNotFound()->assertHeader('X-Content-Type-Options', 'nosniff');
    }

    public function test_authenticated_responses_are_not_cached(): void
    {
        $this->seedRoles();
        $customer = $this->customer();

        $response = $this->asCustomer($customer)->getJson('/api/v1/account/reservations')->assertOk();

        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
    }

    public function test_authenticated_spaces_are_rate_limited_per_user(): void
    {
        $this->seedRoles();
        $manager = $this->staff(RoleName::AgencyManager, Agency::factory()->create());
        $this->asAgency($manager);

        foreach (range(1, 300) as $request) {
            $this->getJson('/api/v1/auth/me')->assertOk();
        }

        $this->getJson('/api/v1/auth/me')->assertTooManyRequests();
    }

    public function test_login_does_not_reveal_whether_an_account_exists(): void
    {
        $this->seedRoles();
        $customer = $this->customer();

        $unknown = $this->postJson('/api/v1/auth/login', ['email' => 'inconnu@example.test', 'password' => 'password']);
        $wrongPassword = $this->postJson('/api/v1/auth/login', ['email' => $customer->email, 'password' => 'mauvais-mot-de-passe']);

        $unknown->assertUnprocessable();
        $wrongPassword->assertUnprocessable();
        $this->assertSame($unknown->json('errors.email'), $wrongPassword->json('errors.email'));
    }

    public function test_production_check_blocks_a_dangerous_configuration(): void
    {
        config(['app.debug' => true, 'payments.driver' => 'mock']);

        $this->artisan('routier:check-production')
            ->expectsOutputToContain('APP_DEBUG=true')
            ->expectsOutputToContain('PAYMENT_DEFAULT_DRIVER=mock')
            ->assertFailed();
    }

    public function test_production_check_accepts_a_sound_configuration(): void
    {
        config([
            'app.env' => 'production',
            'app.debug' => false,
            'app.url' => 'https://api.routier237.cm',
            'cors.allowed_origins' => ['https://routier237.cm'],
            'payments.driver' => 'live',
            'mail.default' => 'resend',
            'services.resend.key' => 're_test_key',
        ]);

        $this->artisan('routier:check-production')
            ->expectsOutputToContain('Aucun point bloquant')
            ->assertSuccessful();
    }
}
