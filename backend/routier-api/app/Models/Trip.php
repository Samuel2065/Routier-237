<?php

namespace App\Models;

use App\Enums\TripStatus;
use App\Models\Concerns\BelongsToAgency;
use Database\Factories\TripFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Occurrence planifiée d'un voyage sur un itinéraire.
 *
 * La capacité est celle du véhicule ; les places restantes sont calculées à partir
 * des réservations valides (cahier des charges §8), jamais stockées.
 */
class Trip extends Model
{
    /** @use HasFactory<TripFactory> */
    use BelongsToAgency, HasFactory;

    protected $fillable = [
        'route_id',
        'vehicle_id',
        'travel_class_id',
        'departure_date',
        'departure_time',
        'price',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'departure_date' => 'date',
            'price' => 'integer',
            'status' => TripStatus::class,
        ];
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function route(): BelongsTo
    {
        return $this->belongsTo(TravelRoute::class, 'route_id');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function travelClass(): BelongsTo
    {
        return $this->belongsTo(TravelClass::class);
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class);
    }
}
