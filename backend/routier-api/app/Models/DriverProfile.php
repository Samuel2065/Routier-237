<?php

namespace App\Models;

use App\Enums\RecordStatus;
use Database\Factories\DriverProfileFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Informations spécifiques au conducteur, liées à son profil employé.
 */
class DriverProfile extends Model
{
    /** @use HasFactory<DriverProfileFactory> */
    use HasFactory;

    protected $fillable = [
        'license_number',
        'license_expires_at',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'license_expires_at' => 'date',
            'status' => RecordStatus::class,
        ];
    }

    public function employeeProfile(): BelongsTo
    {
        return $this->belongsTo(EmployeeProfile::class);
    }
}
