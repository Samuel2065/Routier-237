<?php

namespace App\Http\Controllers\Api\V1\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\TravelClassResource;
use App\Models\TravelClass;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Classes commerciales (VIP, Classique) : filtre de recherche et formulaires.
 */
class TravelClassController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return TravelClassResource::collection(TravelClass::query()->orderBy('name')->get());
    }
}
