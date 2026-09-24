<?php

namespace Database\Factories;

use App\Enums\TripStatus;
use App\Models\Agency;
use App\Models\TravelRoute;
use App\Models\Trip;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Trip>
 *
 * Cohérence garantie : le véhicule appartient à l'agence du trajet
 * et la classe du trajet est celle du véhicule.
 */
class TripFactory extends Factory
{
    public function definition(): array
    {
        return [
            'agency_id' => Agency::factory(),
            'route_id' => TravelRoute::factory(),
            'vehicle_id' => fn (array $attributes) => Vehicle::factory()->state([
                'agency_id' => $attributes['agency_id'],
            ]),
            'travel_class_id' => fn (array $attributes) => Vehicle::query()
                ->whereKey($attributes['vehicle_id'])
                ->value('travel_class_id'),
            'departure_date' => now()->addDays(fake()->numberBetween(1, 30))->toDateString(),
            'departure_time' => fake()->randomElement(['06:00:00', '08:30:00', '12:00:00', '18:00:00']),
            'price' => fake()->randomElement([5000, 6000, 7500, 10000]),
            'status' => TripStatus::Published,
        ];
    }

    public function draft(): static
    {
        return $this->state(['status' => TripStatus::Draft]);
    }
}
