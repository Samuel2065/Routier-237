<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DeviceToken;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;

/**
 * Inscription d'un appareil aux notifications push (Firebase Cloud Messaging), pour le
 * compte connecté, quel que soit son espace.
 *
 * L'appareil est rattaché au jeton de connexion utilisé : il disparaît avec lui
 * (déconnexion, suspension, expiration). Réinscrire le même jeton FCM (renouvellement,
 * nouvelle connexion, autre compte sur le même navigateur) met simplement la ligne à jour.
 * Le jeton FCM n'est jamais renvoyé.
 */
class PushTokenController extends Controller
{
    public function store(Request $request): Response
    {
        $token = $this->validatedToken($request);

        $hash = DeviceToken::hashOf($token);
        $device = DeviceToken::query()->where('token_hash', $hash)->first() ?? new DeviceToken;
        $device->forceFill([
            'token_hash' => $hash,
            'user_id' => $request->user()->id,
            'personal_access_token_id' => $request->user()->currentAccessToken()->getKey(),
            'token' => $token,
            'user_agent' => Str::limit((string) $request->userAgent(), 250, ''),
            'last_registered_at' => now(),
        ])->save();

        return response()->noContent();
    }

    /**
     * Désinscription explicite de cet appareil (bouton « Désactiver »).
     */
    public function destroy(Request $request): Response
    {
        $token = $this->validatedToken($request);

        $request->user()->deviceTokens()->where('token_hash', DeviceToken::hashOf($token))->delete();

        return response()->noContent();
    }

    private function validatedToken(Request $request): string
    {
        return $request->validate(['token' => ['required', 'string', 'min:20', 'max:4096']])['token'];
    }
}
