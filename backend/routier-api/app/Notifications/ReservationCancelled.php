<?php

namespace App\Notifications;

use App\Models\Reservation;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Réservation annulée par l'agence, ou suite à l'annulation du trajet.
 * (Une annulation par le client lui-même ne génère pas de notification.)
 */
class ReservationCancelled extends Notification
{
    public const BY_AGENCY = 'agency';

    public const TRIP_CANCELLED = 'trip_cancelled';

    public function __construct(
        public readonly Reservation $reservation,
        public readonly string $reason,
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("Réservation {$this->reservation->reference} annulée")
            ->greeting("Bonjour {$notifiable->name},")
            ->line($this->message())
            ->line(TripSummary::for($this->reservation))
            ->line('Si vous avez payé cette réservation, l\'agence vous contactera pour le remboursement.');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'reservation_cancelled',
            'reason' => $this->reason,
            'reservation_id' => $this->reservation->id,
            'reference' => $this->reservation->reference,
            'message' => $this->message(),
        ];
    }

    private function message(): string
    {
        return $this->reason === self::TRIP_CANCELLED
            ? "Le trajet de votre réservation {$this->reservation->reference} a été annulé par l'agence."
            : "Votre réservation {$this->reservation->reference} a été annulée par l'agence.";
    }
}
