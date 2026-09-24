<?php

namespace App\Notifications;

use App\Models\Payment;
use Illuminate\Notifications\Notification;

/**
 * Échec d'un paiement : le client peut réessayer tant que sa réservation n'a pas expiré.
 */
class PaymentFailed extends Notification
{
    public function __construct(public readonly Payment $payment) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $reference = $this->payment->reservation->reference;

        return [
            'type' => 'payment_failed',
            'payment_id' => $this->payment->id,
            'reservation_id' => $this->payment->reservation_id,
            'reference' => $reference,
            'message' => "Le paiement de la réservation {$reference} a échoué. Vous pouvez réessayer avant l'expiration de la réservation.",
        ];
    }
}
