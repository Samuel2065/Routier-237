<?php

namespace App\Http\Controllers\Api\V1\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\PublicAgencyResource;
use App\Models\Agency;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Agences visibles publiquement (agence et organisation actives).
 * Les trajets publiés d'une agence sont ajoutés au module 6 (recherche publique).
 */
class AgencyController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate(['city_id' => ['sometimes', 'integer']]);

        $agencies = Agency::query()
            ->publiclyVisible()
            ->with(['organization', 'city'])
            ->when($request->filled('city_id'), fn ($query) => $query->where('city_id', $request->integer('city_id')))
            ->orderBy('name');

        return PublicAgencyResource::collection(
            $this->applySearch($agencies, $request)->paginate($this->perPage($request))->withQueryString()
        );
    }

    public function show(Agency $agency): PublicAgencyResource
    {
        // Une agence inactive (ou d'une organisation suspendue) n'existe pas publiquement.
        abort_unless($agency->isPubliclyVisible(), 404);

        return new PublicAgencyResource($agency->load(['organization', 'city']));
    }
}
