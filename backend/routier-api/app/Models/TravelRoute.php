<?php

namespace App\Models;

use App\Enums\RecordStatus;
use Database\Factories\TravelRouteFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Itinéraire entre une ville de départ et une ville d'arrivée (table « routes »).
 *
 * Le modèle s'appelle TravelRoute pour éviter la confusion avec la façade
 * Illuminate\Support\Facades\Route et le paramètre de route HTTP {route}.
 */
class TravelRoute extends Model
{
    /** @use HasFactory<TravelRouteFactory> */
    use HasFactory;

    protected $table = 'routes';

    protected $fillable = [
        'departure_city_id',
        'destination_city_id',
        'estimated_duration_minutes',
        'distance_km',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'estimated_duration_minutes' => 'integer',
            'distance_km' => 'integer',
            'status' => RecordStatus::class,
        ];
    }

    public function departureCity(): BelongsTo
    {
        return $this->belongsTo(City::class, 'departure_city_id');
    }

    public function destinationCity(): BelongsTo
    {
        return $this->belongsTo(City::class, 'destination_city_id');
    }

    public function trips(): HasMany
    {
        return $this->hasMany(Trip::class, 'route_id');
    }
}
