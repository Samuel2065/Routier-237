<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\Cities\SaveCity;
use App\Http\Controllers\Controller;
use App\Http\Requests\Cities\SaveCityRequest;
use App\Http\Resources\CityResource;
use App\Models\City;
use Illuminate\Http\JsonResponse;

/**
 * Référentiel des villes, géré par la plateforme. Pas de suppression :
 * une ville peut être référencée par des agences et des itinéraires.
 */
class CityController extends Controller
{
    public function store(SaveCityRequest $request, SaveCity $saveCity): JsonResponse
    {
        $city = $saveCity->handle(new City, $request->validated('name'));

        return (new CityResource($city))->response()->setStatusCode(201);
    }

    public function update(SaveCityRequest $request, City $city, SaveCity $saveCity): CityResource
    {
        return new CityResource($saveCity->handle($city, $request->validated('name')));
    }
}
