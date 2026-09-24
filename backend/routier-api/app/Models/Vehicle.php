<?php

namespace App\Models;

use App\Enums\VehicleStatus;
use App\Models\Concerns\BelongsToAgency;
use Database\Factories\VehicleFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Vehicle extends Model
{
    /** @use HasFactory<VehicleFactory> */
    use BelongsToAgency, HasFactory;

    protected $fillable = [
        'travel_class_id',
        'registration_number',
        'brand',
        'model',
        'capacity',
        'amenities',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'capacity' => 'integer',
            'amenities' => 'array',
            'status' => VehicleStatus::class,
        ];
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function travelClass(): BelongsTo
    {
        return $this->belongsTo(TravelClass::class);
    }

    public function trips(): HasMany
    {
        return $this->hasMany(Trip::class);
    }

    /**
     * Plus grand nombre de places consommées sur un trajet à venir de ce véhicule :
     * la capacité ne peut pas descendre en dessous.
     */
    public function maxReservedSeatsOnUpcomingTrips(): int
    {
        $busiestTrip = Reservation::query()
            ->consumingCapacity()
            ->whereIn('trip_id', $this->trips()->upcoming()->select('trips.id'))
            ->selectRaw('trip_id, SUM(passenger_count) AS seats')
            ->groupBy('trip_id')
            ->orderByDesc('seats')
            ->first();

        return (int) ($busiestTrip?->seats ?? 0);
    }
}
