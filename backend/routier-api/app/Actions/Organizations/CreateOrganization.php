<?php

namespace App\Actions\Organizations;

use App\Enums\RecordStatus;
use App\Models\Organization;
use App\Support\UniqueSlug;

/**
 * Création d'une organisation (entreprise de transport) par le super_admin.
 */
class CreateOrganization
{
    /**
     * @param  array{name: string, email?: string|null, phone?: string|null, address?: string|null}  $data
     */
    public function handle(array $data): Organization
    {
        $organization = new Organization($data);
        $organization->slug = UniqueSlug::for(Organization::class, $data['name']);
        $organization->status = RecordStatus::Active;
        $organization->save();

        return $organization;
    }
}
