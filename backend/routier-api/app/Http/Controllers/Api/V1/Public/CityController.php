<?php

namespace App\Http\Controllers\Api\V1\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\CityResource;
use App\Models\City;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Référentiel des villes (recherche publique, formulaires).
 */
class CityController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return CityResource::collection(City::query()->orderBy('name')->get());
    }
}
