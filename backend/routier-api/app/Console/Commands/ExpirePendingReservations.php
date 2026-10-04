<?php

namespace App\Console\Commands;

use App\Enums\ReservationStatus;
use App\Models\Reservation;
use App\Support\LiveUpdates;
use Illuminate\Console\Command;

/**
 * Passe au statut « expired » les réservations en attente dont le délai de paiement est dépassé.
 *
 * Le calcul de disponibilité ignore déjà ces réservations (scope consumingCapacity) :
 * cette tâche aligne simplement leur statut pour l'affichage et l'historique.
 */
class ExpirePendingReservations extends Command
{
    protected $signature = 'reservations:expire';

    protected $description = 'Marque comme expirées les réservations en attente dont le délai de paiement est dépassé';

    public function handle(LiveUpdates $liveUpdates): int
    {
        $expired = Reservation::query()
            ->select(['id', 'trip_id', 'user_id'])
            ->where('status', ReservationStatus::Pending)
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->get();

        $count = $expired->isEmpty() ? 0 : Reservation::query()
            ->whereKey($expired->modelKeys())
            ->where('status', ReservationStatus::Pending)
            ->update(['status' => ReservationStatus::Expired, 'updated_at' => now()]);

        // Mise à jour en masse : aucun événement de modèle, signal explicite aux écrans concernés.
        $expired->each(fn (Reservation $reservation) => $liveUpdates->reservationChanged($reservation));

        $this->info("{$count} réservation(s) expirée(s).");

        return self::SUCCESS;
    }
}
