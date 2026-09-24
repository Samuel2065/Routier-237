<?php

namespace App\Models;

use Database\Factories\TravelClassFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Classe commerciale (VIP, Classique).
 */
class TravelClass extends Model
{
    /** @use HasFactory<TravelClassFactory> */
    use HasFactory;

    public const VIP = 'vip';

    public const CLASSIQUE = 'classique';

    protected $fillable = [
        'code',
        'name',
        'description',
    ];

    public function vehicles(): HasMany
    {
        return $this->hasMany(Vehicle::class);
    }

    public function trips(): HasMany
    {
        return $this->hasMany(Trip::class);
    }
}
