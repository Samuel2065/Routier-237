<?php

namespace App\Models;

use App\Enums\ReservationStatus;
use Database\Factories\ReservationFactory;
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
}
