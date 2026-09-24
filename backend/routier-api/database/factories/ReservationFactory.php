<?php

namespace Database\Factories;

use App\Enums\ReservationStatus;
use App\Models\Reservation;
use App\Models\Trip;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Reservation>
 */
class ReservationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'reference' => 'R237-'.Str::upper(Str::random(8)),
            'trip_id' => Trip::factory(),
            'user_id' => User::factory(),
            'passenger_count' => 1,
            'total_amount' => fn (array $attributes) => Trip::query()
                ->whereKey($attributes['trip_id'])
                ->value('price') * $attributes['passenger_count'],
            'status' => ReservationStatus::Confirmed,
            'expires_at' => null,
            'confirmed_at' => now(),
            'cancelled_at' => null,
        ];
    }

    public function pending(): static
    {
        return $this->state([
            'status' => ReservationStatus::Pending,
            'expires_at' => now()->addMinutes(15),
            'confirmed_at' => null,
        ]);
    }
}
