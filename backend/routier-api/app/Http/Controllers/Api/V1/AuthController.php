<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Auth\IssueAccessToken;
use App\Actions\Auth\RegisterCustomer;
use App\Enums\AccessSpace;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Laravel\Sanctum\NewAccessToken;

/**
 * Authentification par jetons Bearer Sanctum, un point d'entrée par espace
 * (client, agence, administrateur). Chaque jeton est limité à son espace.
 */
class AuthController extends Controller
{
    public function __construct(private readonly IssueAccessToken $tokens) {}

    /**
     * Inscription publique : comptes clients uniquement.
     */
    public function register(RegisterRequest $request, RegisterCustomer $registerCustomer): JsonResponse
    {
        $user = $registerCustomer->handle($request->validated());

        $token = $this->tokens->forUser($user, AccessSpace::Customer, $request->validated('device_name'));

        return $this->tokenResponse($user, $token, AccessSpace::Customer, Response::HTTP_CREATED);
    }

    public function loginCustomer(LoginRequest $request): JsonResponse
    {
        return $this->login($request, AccessSpace::Customer);
    }

    public function loginAgency(LoginRequest $request): JsonResponse
    {
        return $this->login($request, AccessSpace::Agency);
    }

    public function loginAdmin(LoginRequest $request): JsonResponse
    {
        return $this->login($request, AccessSpace::Admin);
    }

    public function me(Request $request): UserResource
    {
        $user = $this->loadProfile($request->user());

        return (new UserResource($user))->additional([
            'meta' => ['space' => AccessSpace::fromToken($user)],
        ]);
    }

    /**
     * Révoque uniquement le jeton utilisé pour la requête.
     */
    public function logout(Request $request): Response
    {
        $request->user()->currentAccessToken()->delete();

        return response()->noContent();
    }

    private function login(LoginRequest $request, AccessSpace $space): JsonResponse
    {
        $token = $this->tokens->handle(
            $request->validated('email'),
            $request->validated('password'),
            $space,
            $request->validated('device_name'),
        );

        return $this->tokenResponse($token->accessToken->tokenable, $token, $space);
    }

    private function tokenResponse(User $user, NewAccessToken $token, AccessSpace $space, int $status = Response::HTTP_OK): JsonResponse
    {
        return response()->json([
            'data' => [
                'token' => $token->plainTextToken,
                'token_type' => 'Bearer',
                'expires_at' => $token->accessToken->expires_at,
                'space' => $space,
                'user' => new UserResource($this->loadProfile($user)),
            ],
        ], $status);
    }

    private function loadProfile(User $user): User
    {
        return $user->loadMissing(['roles.permissions', 'permissions', 'organization', 'employeeProfile.agency.organization']);
    }
}
