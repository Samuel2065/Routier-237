<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\Organizations\CreateDirector;
use App\Http\Controllers\Controller;
use App\Http\Requests\Organizations\StoreDirectorRequest;
use App\Http\Resources\UserResource;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;

/**
 * Création du compte director d'une organisation (/admin/organizations/{id}/directors).
 */
class DirectorController extends Controller
{
    public function store(StoreDirectorRequest $request, Organization $organization, CreateDirector $createDirector): JsonResponse
    {
        $director = $createDirector->handle($organization, $request->validated());

        return (new UserResource($director->load(['roles.permissions', 'permissions', 'organization'])))
            ->response()
            ->setStatusCode(201);
    }
}
