<?php

namespace App\Models\Concerns;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Ressource appartenant à une agence (colonne agency_id) : filtre des listes
 * selon le périmètre de l'utilisateur connecté (isolation inter-agences, §6.2).
 */
trait BelongsToAgency
{
    public function scopeAccessibleBy(Builder $query, User $user): Builder
    {
        $ids = $user->accessibleAgencyIds();

        return $ids === null ? $query : $query->whereIn($this->qualifyColumn('agency_id'), $ids);
    }
}
