<?php

namespace Database\Factories;

use App\Enums\RecordStatus;
use App\Models\Agency;
use App\Models\City;
use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Agency>
 */
class AgencyFactory extends Factory
{
    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'city_id' => City::factory(),
            'name' => 'Agence '.fake()->unique()->words(2, true),
            'email' => fake()->safeEmail(),
            'phone' => fake()->numerify('+2376########'),
            'address' => fake()->streetAddress(),
            'description' => null,
            'status' => RecordStatus::Active,
        ];
    }
}
