<?php

namespace App\Actions\Payments;

use App\Actions\Reservations\ChangeReservationStatus;
use App\Enums\PaymentStatus;
use App\Models\Payment;
use App\Notifications\PaymentFailed;
use App\Notifications\ReservationConfirmed;
use App\Payments\Data\PaymentResult;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Applique le résultat final communiqué par une passerelle (webhook ou simulation).
 *
 * - Idempotent : un paiement déjà finalisé n'est jamais modifié (notifications rejouées ignorées).
 * - Montant contrôlé : un montant reçu différent du montant attendu fait échouer le paiement.
 * - Paiement confirmé → réservation confirmée. Si la réservation ne peut plus l'être
 *   (délai dépassé, annulée entre-temps), le paiement reste « paid » et apparaît
 *   « à rembourser » côté agence.
 */
class ApplyPaymentResult
{
    public function __construct(private readonly ChangeReservationStatus $reservationStatus) {}

    public function handle(PaymentResult $result): Payment
    {
        /** @var Notification|null $notification */
        [$payment, $notification] = DB::transaction(function () use ($result) {
            $payment = Payment::query()
                ->where('provider', $result->provider)
                ->where('transaction_reference', $result->reference)
                ->lockForUpdate()
                ->first();

            abort_if($payment === null, Response::HTTP_NOT_FOUND, 'Paiement inconnu.');

            if (! in_array($payment->status, [PaymentStatus::Pending, PaymentStatus::Processing], true)) {
                return [$payment, null];
            }

            return match ($result->status) {
                PaymentStatus::Paid => $this->markPaid($payment, $result),
                PaymentStatus::Failed, PaymentStatus::Cancelled => $this->markFailed($payment, $result->status, $result->failureReason),
                default => [$payment, null],
            };
        });

        if ($notification !== null) {
            $payment->reservation->user->notify($notification);
        }

        return $payment;
    }

    /**
     * @return array{0: Payment, 1: Notification|null}
     */
    private function markPaid(Payment $payment, PaymentResult $result): array
    {
        if ($result->amount !== null && $result->amount !== $payment->amount) {
            Log::warning('Paiement : montant reçu différent du montant attendu.', [
                'payment_id' => $payment->id, 'expected' => $payment->amount, 'received' => $result->amount,
            ]);

            return $this->markFailed(
                $payment,
                PaymentStatus::Failed,
                "Montant reçu ({$result->amount} FCFA) différent du montant attendu ({$payment->amount} FCFA).",
            );
        }

        $payment->forceFill(['status' => PaymentStatus::Paid, 'paid_at' => now(), 'failure_reason' => null])->save();

        try {
            $reservation = $this->reservationStatus->confirm($payment->reservation);
        } catch (HttpException $exception) {
            Log::warning('Paiement reçu pour une réservation non confirmable : remboursement à prévoir.', [
                'payment_id' => $payment->id, 'reservation_id' => $payment->reservation_id, 'reason' => $exception->getMessage(),
            ]);

            return [$payment, null];
        }

        return [$payment, new ReservationConfirmed($reservation)];
    }

    /**
     * @return array{0: Payment, 1: Notification}
     */
    private function markFailed(Payment $payment, PaymentStatus $status, ?string $reason): array
    {
        $payment->forceFill([
            'status' => $status,
            'failure_reason' => $reason ?? 'Paiement refusé ou abandonné.',
        ])->save();

        return [$payment, new PaymentFailed($payment)];
    }
}
