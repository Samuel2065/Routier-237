<?php

namespace Database\Factories;

use App\Enums\RecordStatus;
use App\Models\DriverProfile;
use App\Models\EmployeeProfile;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DriverProfile>
 */
class DriverProfileFactory extends Factory
{
    public function definition(): array
    {
        return [
            'employee_profile_id' => EmployeeProfile::factory(),
            'license_number' => fake()->unique()->bothify('CM-PERMIS-######'),
            'license_expires_at' => fake()->dateTimeBetween('+6 months', '+5 years')->format('Y-m-d'),
            'status' => RecordStatus::Active,
        ];
    }
}
