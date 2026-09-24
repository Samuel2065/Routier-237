<?php

namespace App\Http\Middleware;

use App\Enums\AccessSpace;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Séparation des espaces client / agence / administrateur.
 *
 * Usage : `space` (n'importe quel espace) ou `space:agency`, `space:admin,agency`...
 *
 * Vérifie à chaque requête que le jeton a été émis pour l'un des espaces autorisés
 * et que le compte (et son organisation/agence) est toujours actif. Un jeton dont
 * le compte a été désactivé est révoqué.
 */
class EnsureAccessSpace
{
    public function handle(Request $request, Closure $next, string ...$spaces): Response
    {
        $user = $request->user();
        abort_if($user === null, Response::HTTP_UNAUTHORIZED);

        $space = AccessSpace::fromToken($user);
        $allowed = $spaces === [] ? AccessSpace::cases() : array_map(AccessSpace::from(...), $spaces);

        abort_unless(
            $space !== null && in_array($space, $allowed, true),
            Response::HTTP_FORBIDDEN,
            'Accès non autorisé depuis cet espace.',
        );

        if (! $user->canEnterSpace($space)) {
            $user->currentAccessToken()?->delete();

            abort(Response::HTTP_FORBIDDEN, 'Votre accès est désactivé.');
        }

        return $next($request);
    }
}
