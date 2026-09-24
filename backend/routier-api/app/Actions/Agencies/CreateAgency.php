<?php

namespace App\Actions\Agencies;

use App\Enums\RecordStatus;
use App\Models\Agency;
use App\Models\Organization;

/**
 * Création d'une agence dans une organisation. L'organisation est toujours fournie
 * par le contexte (director connecté, ou choix explicite du super_admin), jamais
 * déduite d'un champ libre de la requête sans contrôle d'accès.
 */
class CreateAgency
{
    /**
     * @param  array<string, mixed>  $data  Champs validés de l'agence (city_id, name, contacts...).
     */
    public function handle(Organization $organization, array $data): Agency
    {
        $agency = new Agency($data);
        $agency->status ??= RecordStatus::Active;

        return $organization->agencies()->save($agency);
    }
}
