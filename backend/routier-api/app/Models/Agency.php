<?php

namespace App\Models;

use App\Enums\RecordStatus;
use Database\Factories\AgencyFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Point d'exploitation d'une organisation.
 */
class Agency extends Model
{
    /** @use HasFactory<AgencyFactory> */
    use HasFactory;

    protected $fillable = [
        'city_id',
        'name',
        'email',
        'phone',
        'address',
        'description',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'status' => RecordStatus::class,
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class);
    }

    public function employeeProfiles(): HasMany
    {
        return $this->hasMany(EmployeeProfile::class);
    }

    public function vehicles(): HasMany
    {
        return $this->hasMany(Vehicle::class);
    }

    public function trips(): HasMany
    {
        return $this->hasMany(Trip::class);
    }

    /**
     * Agences gérables par l'utilisateur (isolation inter-agences).
     */
    public function scopeAccessibleBy(Builder $query, User $user): Builder
    {
        $ids = $user->accessibleAgencyIds();

        return $ids === null ? $query : $query->whereIn($this->qualifyColumn('id'), $ids);
    }
}
