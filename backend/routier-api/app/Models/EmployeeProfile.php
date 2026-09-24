<?php

namespace App\Models;

use App\Enums\EmployeeStatus;
use App\Models\Concerns\BelongsToAgency;
use Database\Factories\EmployeeProfileFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Extension métier d'un utilisateur interne travaillant dans une agence.
 */
class EmployeeProfile extends Model
{
    /** @use HasFactory<EmployeeProfileFactory> */
    use BelongsToAgency, HasFactory;

    protected $fillable = [
        'employee_number',
        'hired_at',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'hired_at' => 'date',
            'status' => EmployeeStatus::class,
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function driverProfile(): HasOne
    {
        return $this->hasOne(DriverProfile::class);
    }
}
