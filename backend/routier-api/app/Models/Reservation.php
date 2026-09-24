<?php

namespace App\Models;

use App\Enums\ReservationStatus;
use Database\Factories\ReservationFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Commande non transférable d'un client pour un trajet.
 *
 * Aucun champ n'est assignable en masse : référence, montant, statut et dates
 * sont calculés par le service de réservation (module 7).
 */
class Reservation extends Model
{
    /** @use HasFactory<ReservationFactory> */
    use HasFactory;

    protected $fillable = [];

    protected function casts(): array
    {
        return [
            'passenger_count' => 'integer',
            'total_amount' => 'integer',
            'status' => ReservationStatus::class,
            'expires_at' => 'datetime',
            'confirmed_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function passengers(): HasMany
    {
        return $this->hasMany(Passenger::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /**
     * Réservations qui consomment de la capacité (cahier des charges §8) : les confirmées,
     * et les réservations en attente tant que leur délai de validité n'est pas dépassé.
     */
    public function scopeConsumingCapacity(Builder $query): Builder
    {
        return $query->where(function (Builder $query) {
            $query->where($this->qualifyColumn('status'), ReservationStatus::Confirmed)
                ->orWhere(function (Builder $query) {
                    $query->where($this->qualifyColumn('status'), ReservationStatus::Pending)
                        ->where(function (Builder $query) {
                            $query->whereNull($this->qualifyColumn('expires_at'))
                                ->orWhere($this->qualifyColumn('expires_at'), '>', now());
                        });
                });
        });
    }

    /**
     * Client : ses propres réservations. Personnel : celles des trajets de ses agences.
     */
    public function scopeAccessibleBy(Builder $query, User $user): Builder
    {
        if ($user->isCustomer()) {
            return $query->where($this->qualifyColumn('user_id'), $user->getKey());
        }

        $ids = $user->accessibleAgencyIds();

        return $ids === null ? $query : $query->whereIn(
            $this->qualifyColumn('trip_id'),
            Trip::query()->select('id')->whereIn('agency_id', $ids),
        );
    }
}
