<?php

namespace App\Models;

use App\Enums\AccessSpace;
use App\Enums\EmployeeStatus;
use App\Enums\RecordStatus;
use App\Enums\RoleName;
use App\Enums\UserStatus;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

/**
 * Compte utilisateur : clients et utilisateurs internes (cahier des charges §15.4).
 *
 * Périmètre : un director est rattaché à une organisation (organization_id),
 * le personnel d'agence via son employee_profile, un client à rien.
 */
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, Notifiable;

    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'status' => 'active',
    ];

    /**
     * Cache, pour la durée de la requête, des agences accessibles.
     *
     * @var list<int>|null
     */
    protected ?array $accessibleAgencyIdsCache = null;

    /**
     * organization_id et status ne sont pas assignables en masse :
     * ils sont fixés explicitement par le code métier.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'phone',
        'password',
    ];

    /**
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'status' => UserStatus::class,
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function employeeProfile(): HasOne
    {
        return $this->hasOne(EmployeeProfile::class);
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class);
    }

    public function hasRoleName(RoleName $role): bool
    {
        return $this->hasRole($role->value);
    }

    public function isSuperAdmin(): bool
    {
        return $this->hasRoleName(RoleName::SuperAdmin);
    }

    public function isDirector(): bool
    {
        return $this->hasRoleName(RoleName::Director);
    }

    public function isCustomer(): bool
    {
        return $this->hasRoleName(RoleName::Customer);
    }

    /**
     * Personnel rattaché à une agence (hors director et super_admin).
     */
    public function isAgencyStaff(): bool
    {
        return $this->hasAnyRole([
            RoleName::AgencyManager->value,
            RoleName::CounterClerk->value,
            RoleName::Accountant->value,
            RoleName::Driver->value,
        ]);
    }

    /**
     * Rôle fonctionnel principal (un seul rôle par utilisateur en V1).
     */
    public function primaryRole(): ?RoleName
    {
        $name = $this->getRoleNames()->first();

        return $name ? RoleName::tryFrom($name) : null;
    }

    /**
     * Organisation du périmètre : celle du director, ou celle de l'agence de l'employé.
     */
    public function scopedOrganizationId(): ?int
    {
        if ($this->isDirector()) {
            return $this->organization_id;
        }

        return $this->isAgencyStaff() ? $this->employeeProfile?->agency?->organization_id : null;
    }

    /**
     * Agence du périmètre pour le personnel d'agence (null pour les autres rôles).
     */
    public function scopedAgencyId(): ?int
    {
        return $this->isAgencyStaff() ? $this->employeeProfile?->agency_id : null;
    }

    /**
     * Agences que l'utilisateur peut gérer.
     *
     * null : aucune restriction (super_admin). Liste vide : aucune agence (client).
     *
     * @return list<int>|null
     */
    public function accessibleAgencyIds(): ?array
    {
        if ($this->isSuperAdmin()) {
            return null;
        }

        return $this->accessibleAgencyIdsCache ??= match (true) {
            $this->isDirector() => $this->organization_id === null ? [] : Agency::query()
                ->where('organization_id', $this->organization_id)
                ->pluck('id')
                ->all(),
            $this->isAgencyStaff() => array_values(array_filter([$this->scopedAgencyId()])),
            default => [],
        };
    }

    public function canAccessAgency(Agency|int|null $agency): bool
    {
        if ($agency === null) {
            return false;
        }

        $ids = $this->accessibleAgencyIds();

        return $ids === null || in_array($agency instanceof Agency ? $agency->getKey() : $agency, $ids, true);
    }

    public function canAccessOrganization(Organization|int|null $organization): bool
    {
        if ($organization === null) {
            return false;
        }

        if ($this->isSuperAdmin()) {
            return true;
        }

        $id = $organization instanceof Organization ? $organization->getKey() : $organization;

        return $this->scopedOrganizationId() === $id;
    }

    /**
     * Le compte et son rattachement (organisation, agence, profil employé) sont-ils actifs ?
     */
    public function hasActiveAccess(): bool
    {
        if ($this->status !== UserStatus::Active) {
            return false;
        }

        if ($this->isDirector()) {
            return $this->organization?->status === RecordStatus::Active;
        }

        if ($this->isAgencyStaff()) {
            $profile = $this->employeeProfile;

            return $profile !== null
                && $profile->status === EmployeeStatus::Active
                && $profile->agency->status === RecordStatus::Active
                && $profile->agency->organization->status === RecordStatus::Active;
        }

        return true;
    }

    public function canEnterSpace(AccessSpace $space): bool
    {
        return $this->hasAnyRole(array_map(fn (RoleName $role) => $role->value, $space->allowedRoles()))
            && $this->hasActiveAccess();
    }

    /**
     * Rôles que cet utilisateur peut attribuer à un membre du personnel.
     *
     * @return list<RoleName>
     */
    public function assignableRoles(): array
    {
        return $this->primaryRole()?->assignableRoles() ?? [];
    }
}
