<?php

namespace App\Http\Controllers\Api\V1\Agency;

use App\Actions\Payments\RefundPayment;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\ReservationStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentResource;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Suivi des paiements des réservations de l'agence (/agency/payments) et remboursements.
 */
class PaymentController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Payment::class);

        $request->validate([
            'status' => ['sometimes', Rule::enum(PaymentStatus::class)],
            'method' => ['sometimes', Rule::enum(PaymentMethod::class)],
            'trip_id' => ['sometimes', 'integer'],
            'date_from' => ['sometimes', 'date_format:Y-m-d'],
            'date_to' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            'requires_refund' => ['sometimes', 'boolean'],
        ]);

        $payments = Payment::query()
            ->accessibleBy($request->user())
            ->with('reservation')
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->query('status')))
            ->when($request->filled('method'), fn ($query) => $query->where('method', $request->query('method')))
            ->when($request->filled('trip_id'), fn ($query) => $query->whereHas(
                'reservation',
                fn ($reservation) => $reservation->where('trip_id', $request->integer('trip_id')),
            ))
            ->when($request->filled('date_from'), fn ($query) => $query->whereDate('created_at', '>=', $request->query('date_from')))
            ->when($request->filled('date_to'), fn ($query) => $query->whereDate('created_at', '<=', $request->query('date_to')))
            ->when($request->boolean('requires_refund'), fn ($query) => $query
                ->where('status', PaymentStatus::Paid)
                ->whereHas('reservation', fn ($reservation) => $reservation->where('status', '!=', ReservationStatus::Confirmed)))
            ->latest('id');

        return PaymentResource::collection($payments->paginate($this->perPage($request, 25))->withQueryString());
    }

    public function show(Payment $payment): PaymentResource
    {
        Gate::authorize('view', $payment);

        return new PaymentResource($payment->load('reservation'));
    }

    public function refund(Payment $payment, RefundPayment $refundPayment): PaymentResource
    {
        Gate::authorize('refund', $payment);

        return new PaymentResource($refundPayment->handle($payment)->load('reservation'));
    }
}
