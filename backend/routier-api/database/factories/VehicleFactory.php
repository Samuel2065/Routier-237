<?php

namespace Database\Factories;

use App\Enums\VehicleStatus;
use App\Models\Agency;
use App\Models\TravelClass;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Vehicle>
 */
class VehicleFactory extends Factory
{
    public function definition(): array
    {
        return [
            'agency_id' => Agency::factory(),
            'travel_class_id' => TravelClass::factory(),
            'registration_number' => fake()->unique()->bothify('?? ###-?? ##'),
            'brand' => fake()->randomElement(['Toyota', 'Mercedes-Benz', 'Yutong', 'Hyundai']),
            'model' => fake()->randomElement(['Coaster', 'Sprinter', 'ZK6122', 'County']),
            'capacity' => fake()->numberBetween(20, 70),
            'amenities' => ['climatisation'],
            'status' => VehicleStatus::Active,
        ];
    }
}
