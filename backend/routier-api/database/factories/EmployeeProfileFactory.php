<?php

namespace Database\Factories;

use App\Enums\EmployeeStatus;
use App\Models\Agency;
use App\Models\EmployeeProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<EmployeeProfile>
 */
class EmployeeProfileFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'agency_id' => Agency::factory(),
            'employee_number' => fake()->unique()->bothify('EMP-#####'),
            'hired_at' => fake()->dateTimeBetween('-5 years', 'now')->format('Y-m-d'),
            'status' => EmployeeStatus::Active,
        ];
    }
}
