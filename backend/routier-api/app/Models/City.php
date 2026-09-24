<?php

namespace App\Models;

use Database\Factories\CityFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class City extends Model
{
    /** @use HasFactory<CityFactory> */
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
    ];

    public function agencies(): HasMany
    {
        return $this->hasMany(Agency::class);
    }

    public function departureRoutes(): HasMany
    {
        return $this->hasMany(TravelRoute::class, 'departure_city_id');
    }

    public function destinationRoutes(): HasMany
    {
        return $this->hasMany(TravelRoute::class, 'destination_city_id');
    }
}
