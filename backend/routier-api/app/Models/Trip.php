<?php

namespace App\Models;

use App\Enums\RecordStatus;
use App\Enums\TripStatus;
use App\Enums\VehicleStatus;
use App\Models\Concerns\BelongsToAgency;
use Carbon\CarbonImmutable;
use Database\Factories\TripFactory;
use Illuminate\Database\Eloquent\Builder;
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

    /**
     * Trajets à venir encore exploitables (brouillon ou publié, date du jour ou future).
     */
    public function scopeUpcoming(Builder $query): Builder
    {
        return $query
            ->whereIn($this->qualifyColumn('status'), [TripStatus::Draft, TripStatus::Published])
            ->whereDate($this->qualifyColumn('departure_date'), '>=', today());
    }

    /**
     * Trajets visibles et réservables publiquement (§5.1) : publiés, départ à venir,
     * agence et organisation actives, véhicule en service, itinéraire actif.
     */
    public function scopePubliclyAvailable(Builder $query): Builder
    {
        $now = now();

        return $query
            ->where($this->qualifyColumn('status'), TripStatus::Published)
            ->whereIn($this->qualifyColumn('agency_id'), Agency::query()->publiclyVisible()->select('agencies.id'))
            ->whereIn($this->qualifyColumn('vehicle_id'), Vehicle::query()->select('id')->where('status', VehicleStatus::Active))
            ->whereIn($this->qualifyColumn('route_id'), TravelRoute::query()->select('id')->where('status', RecordStatus::Active))
            ->where(function (Builder $query) use ($now) {
                $query->whereDate($this->qualifyColumn('departure_date'), '>', $now->toDateString())
                    ->orWhere(function (Builder $query) use ($now) {
                        $query->whereDate($this->qualifyColumn('departure_date'), $now->toDateString())
                            ->where($this->qualifyColumn('departure_time'), '>', $now->format('H:i:s'));
                    });
            });
    }

    /**
     * Trajets ayant encore au moins $seats places : capacité du véhicule − places consommées.
     * Calcul en SQL pour filtrer avant pagination.
     */
    public function scopeWithRemainingSeatsAtLeast(Builder $query, int $seats): Builder
    {
        $capacity = Vehicle::query()
            ->select('capacity')
            ->whereColumn('vehicles.id', $this->qualifyColumn('vehicle_id'));

        $reserved = Reservation::query()
            ->consumingCapacity()
            ->selectRaw('COALESCE(SUM(passenger_count), 0)')
            ->whereColumn('reservations.trip_id', $this->qualifyColumn('id'));

        return $query->whereRaw(
            '('.$capacity->toSql().') - ('.$reserved->toSql().') >= ?',
            [...$capacity->getBindings(), ...$reserved->getBindings(), $seats],
        );
    }

    /**
     * Le trajet peut-il recevoir une réservation maintenant ? (contrôle définitif sous verrou au module 7)
     */
    public function isBookable(int $seats = 1): bool
    {
        return $this->status === TripStatus::Published
            && ! $this->hasDeparted()
            && $this->agency->isPubliclyVisible()
            && $this->vehicle->status === VehicleStatus::Active
            && $this->route->status === RecordStatus::Active
            && $this->remainingSeats() >= $seats;
    }

    /**
     * Ajoute l'attribut reserved_seats : places consommées par les réservations valides (§8).
     */
    public function scopeWithReservedSeats(Builder $query): Builder
    {
        return $query->withSum(
            ['reservations as reserved_seats' => fn (Builder $reservations) => $reservations->consumingCapacity()],
            'passenger_count',
        );
    }

    /**
     * Date et heure de départ (fuseau de l'application, Africa/Douala).
     */
    public function departsAt(): CarbonImmutable
    {
        return CarbonImmutable::parse($this->departure_date->toDateString().' '.$this->departure_time);
    }

    /**
     * Arrivée estimée d'après la durée indicative de l'itinéraire (60 min si inconnue).
     */
    public function arrivesAt(): CarbonImmutable
    {
        return $this->departsAt()->addMinutes($this->route->estimated_duration_minutes ?? 60);
    }

    public function hasDeparted(): bool
    {
        return $this->departsAt()->lessThanOrEqualTo(now());
    }

    /**
     * Capacité réelle : celle du véhicule, jamais une valeur saisie sur le trajet.
     */
    public function capacity(): int
    {
        return $this->vehicle->capacity;
    }

    public function reservedSeats(): int
    {
        if (array_key_exists('reserved_seats', $this->attributes)) {
            return (int) $this->attributes['reserved_seats'];
        }

        return (int) $this->reservations()->consumingCapacity()->sum('passenger_count');
    }

    /**
     * Places restantes = capacité du véhicule − passagers réservés valides (§8).
     */
    public function remainingSeats(): int
    {
        return max(0, $this->capacity() - $this->reservedSeats());
    }
}
