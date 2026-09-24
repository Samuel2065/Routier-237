<?php

namespace App\Models;

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use Database\Factories\PaymentFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Transaction financière liée à une réservation.
 *
 * Montant, statut et référence sont fixés par le service de paiement (module 8) :
 * seul le moyen de paiement choisi est assignable.
 */
class Payment extends Model
{
    /** @use HasFactory<PaymentFactory> */
    use HasFactory;

    protected $fillable = [
        'method',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'method' => PaymentMethod::class,
            'status' => PaymentStatus::class,
            'paid_at' => 'datetime',
        ];
    }

    public function reservation(): BelongsTo
    {
        return $this->belongsTo(Reservation::class);
    }

    /**
     * Même périmètre que la réservation associée.
     */
    public function scopeAccessibleBy(Builder $query, User $user): Builder
    {
        return $query->whereIn(
            $this->qualifyColumn('reservation_id'),
            Reservation::query()->select('reservations.id')->accessibleBy($user),
        );
    }
}
