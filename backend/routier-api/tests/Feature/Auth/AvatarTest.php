<?php

namespace Tests\Feature\Auth;

use App\Enums\RoleName;
use App\Models\Agency;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\AuthenticatesInSpace;
use Tests\Concerns\CreatesUsers;
use Tests\TestCase;

class AvatarTest extends TestCase
{
    use AuthenticatesInSpace, CreatesUsers, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRoles();
        Storage::fake('public');
    }

    public function test_every_space_uploads_its_own_profile_photo(): void
    {
        $customer = $this->customer();
        $response = $this->asCustomer($customer)
            ->post('/api/v1/auth/me/avatar', ['avatar' => UploadedFile::fake()->image('moi.png', 200, 200)], ['Accept' => 'application/json'])
            ->assertOk();

        $path = $customer->fresh()->avatar_path;
        $this->assertStringStartsWith('avatars/'.$customer->id.'-', $path);
        $this->assertStringEndsWith('.png', $path);
        Storage::disk('public')->assertExists($path);
        $response->assertJsonPath('data.avatar_url', Storage::disk('public')->url($path));

        $staff = $this->staff(RoleName::Driver, Agency::factory()->create());
        $this->asAgency($staff)
            ->post('/api/v1/auth/me/avatar', ['avatar' => UploadedFile::fake()->image('photo.jpg', 300, 300)], ['Accept' => 'application/json'])
            ->assertOk();
        $this->assertNotNull($staff->fresh()->avatar_path);

        $admin = $this->superAdmin();
        $this->asAdmin($admin)
            ->post('/api/v1/auth/me/avatar', ['avatar' => UploadedFile::fake()->image('photo.webp', 300, 300)], ['Accept' => 'application/json'])
            ->assertOk();
        $this->assertNotNull($admin->fresh()->avatar_path);
    }

    public function test_a_new_photo_replaces_and_deletes_the_previous_one(): void
    {
        $customer = $this->customer();

        $this->asCustomer($customer)->post('/api/v1/auth/me/avatar', ['avatar' => UploadedFile::fake()->image('a.jpg', 100, 100)], ['Accept' => 'application/json']);
        $first = $customer->fresh()->avatar_path;

        $this->asCustomer($customer)->post('/api/v1/auth/me/avatar', ['avatar' => UploadedFile::fake()->image('b.jpg', 100, 100)], ['Accept' => 'application/json']);
        $second = $customer->fresh()->avatar_path;

        $this->assertNotSame($first, $second);
        Storage::disk('public')->assertMissing($first);
        Storage::disk('public')->assertExists($second);
    }

    public function test_the_photo_can_be_removed(): void
    {
        $customer = $this->customer();
        $this->asCustomer($customer)->post('/api/v1/auth/me/avatar', ['avatar' => UploadedFile::fake()->image('a.jpg', 100, 100)], ['Accept' => 'application/json']);
        $path = $customer->fresh()->avatar_path;

        $this->asCustomer($customer)->deleteJson('/api/v1/auth/me/avatar')
            ->assertOk()
            ->assertJsonPath('data.avatar_url', null);

        $this->assertNull($customer->fresh()->avatar_path);
        Storage::disk('public')->assertMissing($path);
    }

    public function test_only_reasonable_images_are_accepted(): void
    {
        $customer = $this->customer();
        $upload = fn (UploadedFile $file) => $this->asCustomer($customer)
            ->post('/api/v1/auth/me/avatar', ['avatar' => $file], ['Accept' => 'application/json']);

        $upload(UploadedFile::fake()->create('cv.pdf', 100, 'application/pdf'))->assertUnprocessable()->assertJsonValidationErrors('avatar');
        $upload(UploadedFile::fake()->create('logo.svg', 10, 'image/svg+xml'))->assertUnprocessable()->assertJsonValidationErrors('avatar');
        $upload(UploadedFile::fake()->image('lourde.jpg', 800, 800)->size(3000))->assertUnprocessable()->assertJsonValidationErrors('avatar');
        $upload(UploadedFile::fake()->image('minuscule.png', 20, 20))->assertUnprocessable()->assertJsonValidationErrors('avatar');
        $this->asCustomer($customer)->postJson('/api/v1/auth/me/avatar', [])->assertUnprocessable()->assertJsonValidationErrors('avatar');

        $this->assertNull($customer->fresh()->avatar_path);
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_a_visitor_cannot_upload_a_photo(): void
    {
        $this->post('/api/v1/auth/me/avatar', ['avatar' => UploadedFile::fake()->image('a.jpg', 100, 100)], ['Accept' => 'application/json'])
            ->assertUnauthorized();
    }
}
