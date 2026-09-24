<?php

namespace App\Actions\Cities;

use App\Models\City;
use App\Support\UniqueSlug;

/**
 * Création ou renommage d'une ville du référentiel ; le slug suit le nom.
 */
class SaveCity
{
    public function handle(City $city, string $name): City
    {
        $city->name = $name;
        $city->slug = UniqueSlug::for(City::class, $name, $city->getKey());
        $city->save();

        return $city;
    }
}
