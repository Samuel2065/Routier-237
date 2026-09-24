<?php

namespace Database\Factories;

use App\Models\TravelClass;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<TravelClass>
 */
class TravelClassFactory extends Factory
{
    public function definition(): array
    {
        $name = Str::title(fake()->unique()->word());

        return [
            'code' => Str::slug($name).'-'.Str::lower(Str::random(4)),
            'name' => $name,
            'description' => null,
        ];
    }
}
