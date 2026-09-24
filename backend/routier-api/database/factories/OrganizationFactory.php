<?php

namespace Database\Factories;

use App\Enums\RecordStatus;
use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Organization>
 */
class OrganizationFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->unique()->company().' Voyages';

        return [
            'name' => $name,
            'slug' => Str::slug($name).'-'.Str::lower(Str::random(4)),
            'email' => fake()->unique()->safeEmail(),
            'phone' => fake()->numerify('+2376########'),
            'address' => fake()->streetAddress(),
            'status' => RecordStatus::Active,
        ];
    }
}
