<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Payments\ApplyPaymentResult;
use App\Http\Controllers\Controller;
use App\Payments\PaymentGatewayFactory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Notifications serveur à serveur des fournisseurs de paiement
 * (/payments/webhooks/{provider}). Pas d'authentification utilisateur :
 * l'authenticité est vérifiée par la passerelle (signature).
 */
class PaymentWebhookController extends Controller
{
    public function __invoke(Request $request, string $provider, PaymentGatewayFactory $gateways, ApplyPaymentResult $applyResult): JsonResponse
    {
        $gateway = $gateways->byName($provider);
        abort_if($gateway === null, 404);

        $result = $gateway->parseWebhook($request);
        abort_unless($result->provider === $gateway->name(), 400, 'Fournisseur incohérent.');

        $payment = $applyResult->handle($result);

        return response()->json(['data' => ['received' => true, 'status' => $payment->status]]);
    }
}
