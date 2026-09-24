<?php

namespace App\Http\Controllers\Api\V1\Agency;

use App\Actions\Dashboard\BuildAgencyDashboard;
use App\Enums\PermissionName;
use App\Http\Controllers\Controller;
use App\Models\Agency;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Tableau de bord de l'espace agence (/agency/dashboard).
 */
class DashboardController extends Controller
{
    public function __invoke(Request $request, BuildAgencyDashboard $dashboard): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->checkPermissionTo(PermissionName::DashboardView->value), 403);

        $request->validate(['agency_id' => ['sometimes', 'integer']]);

        $agency = null;
        if ($request->filled('agency_id')) {
            $agency = Agency::query()->find($request->integer('agency_id'));
            // Agence hors périmètre : refus explicite, jamais de données d'une autre agence.
            abort_unless($agency !== null && $user->canAccessAgency($agency), 403);
        }

        return response()->json(['data' => $dashboard->handle($user, $agency)]);
    }
}
