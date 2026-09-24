<?php

namespace App\Models;

use App\Enums\RecordStatus;
use Database\Factories\OrganizationFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Entreprise de transport, propriétaire d'une ou plusieurs agences.
 */
class Organization extends Model
{
    /** @use HasFactory<OrganizationFactory> */
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'email',
        'phone',
        'address',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'status' => RecordStatus::class,
        ];
    }

    public function agencies(): HasMany
    {
        return $this->hasMany(Agency::class);
    }

    /**
     * Utilisateurs de niveau direction rattachés à l'organisation.
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
