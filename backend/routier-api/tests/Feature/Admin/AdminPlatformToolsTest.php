<?php

namespace Tests\Feature\Admin;

use App\Enums\PaymentStatus;
use App\Enums\RoleName;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\AuditLog;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Trip;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\Concerns\AuthenticatesInSpace;
use Tests\Concerns\CreatesUsers;
use Tests\TestCase;

/**
 * Phase 4 : outils du super_admin — supervision de l'activité (lecture seule, données
 * personnelles limitées), réinitialisation sécurisée du mot de passe et journal d'audit.
 */
class AdminPlatformToolsTest extends TestCase
{
    use AuthenticatesInSpace, CreatesUsers, RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRoles();
        $this->admin = $this->superAdmin();
    }

    public function test_the_admin_supervises_activity_of_every_organization_with_filters(): void
    {
        $agencyA = Agency::factory()->for(Organization::factory())->create();
        $agencyB = Agency::factory()->for(Organization::factory())->create();
        $customer = User::factory()->create(['phone' => '699 11 22 33'])->assignRole(RoleName::Customer->value);
        $reservationA = Reservation::factory()->for(Trip::factory()->for($agencyA))->for($customer)->create();
        $reservationB = Reservation::factory()->for(Trip::factory()->for($agencyB))->create();
        Payment::factory()->for($reservationA)->create(['payer_phone' => '+237 699 11 22 33', 'status' => PaymentStatus::Paid, 'paid_at' => now()]);
        Payment::factory()->for($reservationB)->create();

        $this->asAdmin($this->admin)->getJson('/api/v1/admin/trips')->assertOk()->assertJsonCount(2, 'data');
        $this->asAdmin($this->admin)->getJson("/api/v1/admin/trips?organization_id={$agencyA->organization_id}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.agency.organization.id', $agencyA->organization_id);

        $reservation = $this->asAdmin($this->admin)->getJson("/api/v1/admin/reservations?agency_id={$agencyA->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.reference', $reservationA->reference)
            ->assertJsonPath('data.0.customer.name', $customer->name)
            ->json('data.0');
        // Données personnelles limitées : ni contact du client ni passagers.
        $this->assertSame(['id', 'name'], array_keys($reservation['customer']));
        $this->assertArrayNotHasKey('passengers', $reservation);

        $this->asAdmin($this->admin)->getJson("/api/v1/admin/reservations?search={$reservationB->reference}")
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $reservationB->id);

        $this->asAdmin($this->admin)->getJson("/api/v1/admin/payments?organization_id={$agencyA->organization_id}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.payer_phone', '••••••••••33')
            ->assertJsonPath('data.0.organization.id', $agencyA->organization_id);
    }

    public function test_activity_supervision_is_refused_outside_the_admin_space(): void
    {
        $agency = Agency::factory()->create();
        $director = $this->director($agency->organization);
        $manager = $this->staff(RoleName::AgencyManager, $agency);

        foreach (['trips', 'reservations', 'payments', 'audit-logs'] as $path) {
            $this->asCustomer($this->customer())->getJson("/api/v1/admin/{$path}")->assertForbidden();
            $this->asAgency($director)->getJson("/api/v1/admin/{$path}")->assertForbidden();
            $this->asAgency($manager)->getJson("/api/v1/admin/{$path}")->assertForbidden();
        }
    }

    public function test_the_admin_sends_a_reset_link_but_never_sees_or_sets_the_password(): void
    {
        Notification::fake();
        $customer = $this->customer();
        $passwordHash = $customer->password;

        $this->asAdmin($this->admin)->postJson("/api/v1/admin/users/{$customer->id}/password-reset")
            ->assertOk()
            ->assertJsonPath('message', "Un lien de réinitialisation a été envoyé à {$customer->email}.")
            ->assertJsonMissingPath('token')
            ->assertJsonMissingPath('password');

        Notification::assertSentTo($customer, ResetPassword::class, function (ResetPassword $notification) use ($customer) {
            $url = $notification->toMail($customer)->actionUrl;

            return str_starts_with($url, 'http://localhost:5173/reset-password?token=')
                && str_contains($url, 'email='.urlencode($customer->email));
        });
        $this->assertSame($passwordHash, $customer->fresh()->password);

        $entry = AuditLog::query()->sole();
        $this->assertSame('user.password_reset_link_sent', $entry->action);
        $this->assertSame($this->admin->id, $entry->actor_id);
        $this->assertSame($customer->id, $entry->subject_id);

        // Deuxième demande immédiate : limitée par Laravel (une par minute et par compte).
        $this->asAdmin($this->admin)->postJson("/api/v1/admin/users/{$customer->id}/password-reset")->assertStatus(429);
        // Pas par cette voie pour son propre compte (page « Mot de passe oublié »).
        $this->asAdmin($this->admin)->postJson("/api/v1/admin/users/{$this->admin->id}/password-reset")->assertForbidden();
    }

    public function test_forgot_password_never_reveals_whether_an_account_exists(): void
    {
        Notification::fake();
        $customer = $this->customer();

        $known = $this->postJson('/api/v1/auth/forgot-password', ['email' => $customer->email])->assertOk()->json('message');
        $unknown = $this->postJson('/api/v1/auth/forgot-password', ['email' => 'inconnu@routier237.test'])->assertOk()->json('message');

        $this->assertSame($known, $unknown);
        Notification::assertSentTo($customer, ResetPassword::class);
        Notification::assertSentTimes(ResetPassword::class, 1);
    }

    public function test_a_reset_link_sets_a_new_password_once_and_closes_every_session(): void
    {
        $manager = $this->staff(RoleName::AgencyManager, Agency::factory()->create());
        $this->asAgency($manager)->getJson('/api/v1/auth/me')->assertOk();
        $this->assertSame(1, $manager->tokens()->count());
        $token = Password::createToken($manager);

        $payload = ['token' => $token, 'email' => $manager->email, 'password' => 'NouveauSecret2026', 'password_confirmation' => 'NouveauSecret2026'];

        $this->app['auth']->forgetGuards();
        $this->withoutToken()->postJson('/api/v1/auth/reset-password', ['password' => 'court'] + $payload)->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->postJson('/api/v1/auth/reset-password', $payload)->assertOk()->assertJsonPath('space', 'agency');

        $this->assertTrue(Hash::check('NouveauSecret2026', $manager->fresh()->password));
        $this->assertSame(0, $manager->tokens()->count());
        $this->assertSame('user.password_reset', AuditLog::query()->where('subject_id', $manager->id)->value('action'));

        // Lien à usage unique.
        $this->postJson('/api/v1/auth/reset-password', $payload)->assertUnprocessable()->assertJsonValidationErrors('email');

        // Le nouveau mot de passe ouvre l'espace de la personne.
        $this->postJson('/api/v1/agency/auth/login', ['email' => $manager->email, 'password' => 'NouveauSecret2026'])->assertOk();
    }

    public function test_sensitive_actions_are_journaled_without_secrets(): void
    {
        $agency = Agency::factory()->create();
        $manager = $this->staff(RoleName::AgencyManager, $agency);
        $clerk = $this->staff(RoleName::CounterClerk, $agency);
        $customer = $this->customer();

        $this->asAdmin($this->admin)->patchJson("/api/v1/admin/users/{$customer->id}", ['status' => UserStatus::Suspended->value])->assertOk();
        $this->asAgency($manager)->patchJson("/api/v1/agency/employees/{$clerk->employeeProfile->id}", ['password' => 'MotDePasse2026'])->assertOk();
        $this->asAdmin($this->admin)->patchJson("/api/v1/admin/organizations/{$agency->organization_id}", ['status' => 'inactive'])->assertOk();

        $suspension = AuditLog::query()->where('action', 'user.suspended')->sole();
        $this->assertSame(['fields' => ['status'], 'status' => ['from' => 'active', 'to' => 'suspended']], $suspension->metadata);
        $this->assertSame($this->admin->name, $suspension->actor_name);

        $employeeUpdate = AuditLog::query()->where('action', 'employee.updated')->sole();
        $this->assertSame($manager->id, $employeeUpdate->actor_id);
        $this->assertTrue($employeeUpdate->metadata['password_changed']);
        $this->assertStringNotContainsString('MotDePasse2026', json_encode(AuditLog::query()->get()->toArray()));

        $this->assertTrue(AuditLog::query()->where('action', 'organization.suspended')->exists());

        $this->asAdmin($this->admin)->getJson('/api/v1/admin/audit-logs?action=user.')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.action', 'user.suspended')
            ->assertJsonPath('data.0.subject.label', "{$customer->name} ({$customer->email})");
        $this->asAdmin($this->admin)->getJson("/api/v1/admin/audit-logs?actor_id={$manager->id}")->assertJsonCount(1, 'data');
    }

    public function test_the_account_detail_shows_role_permissions_and_sessions_never_secrets(): void
    {
        $manager = $this->staff(RoleName::AgencyManager, Agency::factory()->create());
        $this->asAgency($manager)->getJson('/api/v1/auth/me')->assertOk();

        $data = $this->asAdmin($this->admin)->getJson("/api/v1/admin/users/{$manager->id}")
            ->assertOk()
            ->assertJsonPath('data.role', RoleName::AgencyManager->value)
            ->assertJsonPath('data.active_sessions', 1)
            ->assertJsonPath('data.push_devices', 0)
            ->json('data');

        $this->assertContains('trips.publish', $data['permissions']);
        $this->assertNotContains('payments.refund', $data['permissions']);
        $this->assertNotNull($data['last_active_at']);
        foreach (['password', 'remember_token', 'token'] as $secret) {
            $this->assertArrayNotHasKey($secret, $data);
        }
    }
}
