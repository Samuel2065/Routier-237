<?php

namespace Database\Factories;

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Models\Payment;
use App\Models\Reservation;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Payment>
 */
class PaymentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'reservation_id' => Reservation::factory(),
            'amount' => fn (array $attributes) => Reservation::query()
                ->whereKey($attributes['reservation_id'])
                ->value('total_amount'),
            'currency' => 'XAF',
            'method' => fake()->randomElement(PaymentMethod::cases()),
            'status' => PaymentStatus::Pending,
            'transaction_reference' => null,
            'paid_at' => null,
        ];
    }
}
