<?php

namespace Database\Factories;

use App\Enums\PassengerType;
use App\Models\Passenger;
use App\Models\Reservation;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Passenger>
 */
class PassengerFactory extends Factory
{
    public function definition(): array
    {
        return [
            'reservation_id' => Reservation::factory(),
            'full_name' => fake()->name(),
            'phone' => fake()->numerify('+2376########'),
            'birth_date' => fake()->dateTimeBetween('-60 years', '-18 years')->format('Y-m-d'),
            'passenger_type' => PassengerType::Adult,
        ];
    }

    public function child(): static
    {
        return $this->state([
            'phone' => null,
            'birth_date' => fake()->dateTimeBetween('-11 years', '-2 years')->format('Y-m-d'),
            'passenger_type' => PassengerType::Child,
        ]);
    }
}
