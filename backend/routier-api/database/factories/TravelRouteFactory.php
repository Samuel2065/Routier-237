<?php

namespace Database\Factories;

use App\Enums\RecordStatus;
use App\Models\City;
use App\Models\TravelRoute;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TravelRoute>
 */
class TravelRouteFactory extends Factory
{
    public function definition(): array
    {
        return [
            'departure_city_id' => City::factory(),
            'destination_city_id' => City::factory(),
            'estimated_duration_minutes' => fake()->numberBetween(60, 600),
            'distance_km' => fake()->numberBetween(50, 800),
            'status' => RecordStatus::Active,
        ];
    }
}
