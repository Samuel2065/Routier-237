<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Actions\Payments\ApplyPaymentResult;
use App\Actions\Payments\InitiatePayment;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Payments\StorePaymentRequest;
use App\Http\Resources\PaymentResource;
use App\Models\Payment;
use App\Models\Reservation;
use App\Payments\Data\PaymentResult;
use App\Payments\Gateways\MockGateway;
use App\Payments\PaymentGatewayFactory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Paiement de ses réservations par le client (/account/reservations/{id}/payments).
 */
class PaymentController extends Controller
{
    public function store(StorePaymentRequest $request, Reservation $reservation, InitiatePayment $initiatePayment): JsonResponse
    {
        [$payment, $initiation] = $initiatePayment->handle(
            $reservation,
            $request->paymentMethod(),
            $request->validated('phone'),
        );

        return (new PaymentResource($payment->load('reservation')))
            ->additional([
                'meta' => [
                    'instructions' => $initiation->message,
                    'redirect_url' => $initiation->redirectUrl,
                ],
            ])
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Suivi du statut (le frontend interroge cet endpoint pendant le traitement).
     */
    public function show(Payment $payment): PaymentResource
    {
        Gate::authorize('view', $payment);

        return new PaymentResource($payment->load('reservation'));
    }

    /**
     * Simulation du résultat d'un paiement (passerelle « mock », hors production uniquement),
     * pour développer et tester le parcours de réservation sans fournisseur réel.
     */
    public function simulate(Request $request, Payment $payment, PaymentGatewayFactory $gateways, ApplyPaymentResult $applyResult): PaymentResource
    {
        abort_unless(
            $gateways->usesMock() && ! app()->isProduction() && $payment->provider === MockGateway::NAME,
            404,
        );
        Gate::authorize('create', [Payment::class, $payment->reservation]);

        $data = $request->validate(['outcome' => ['required', 'in:paid,failed']]);

        $payment = $applyResult->handle(new PaymentResult(
            provider: MockGateway::NAME,
            reference: (string) $payment->transaction_reference,
            status: PaymentStatus::from($data['outcome']),
            amount: $payment->amount,
            failureReason: $data['outcome'] === 'failed' ? 'Paiement refusé (simulation).' : null,
        ));

        return new PaymentResource($payment->fresh()->load('reservation'));
    }
}
