<?php

namespace App\Models;

use App\Enums\PassengerType;
use Database\Factories\PassengerFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Personne transportée dans le cadre d'une réservation (sans compte obligatoire).
 */
class Passenger extends Model
{
    /** @use HasFactory<PassengerFactory> */
    use HasFactory;

    protected $fillable = [
        'full_name',
        'phone',
        'birth_date',
        'passenger_type',
    ];

    protected function casts(): array
    {
        return [
            'birth_date' => 'date',
            'passenger_type' => PassengerType::class,
        ];
    }

    public function reservation(): BelongsTo
    {
        return $this->belongsTo(Reservation::class);
    }
}
