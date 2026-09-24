<?php

namespace App\Notifications;

use App\Models\Reservation;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Réservation confirmée après paiement.
 */
class ReservationConfirmed extends Notification
{
    public function __construct(public readonly Reservation $reservation) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $summary = TripSummary::for($this->reservation);

        return (new MailMessage)
            ->subject("Réservation {$this->reservation->reference} confirmée")
            ->greeting("Bonjour {$notifiable->name},")
            ->line("Votre réservation {$this->reservation->reference} est confirmée.")
            ->line($summary)
            ->line("Passagers : {$this->reservation->passenger_count} — Montant payé : {$this->reservation->total_amount} FCFA.")
            ->line('Présentez cette référence au guichet de l\'agence avant le départ.');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'reservation_confirmed',
            'reservation_id' => $this->reservation->id,
            'reference' => $this->reservation->reference,
            'message' => "Votre réservation {$this->reservation->reference} est confirmée. ".TripSummary::for($this->reservation),
        ];
    }
}
