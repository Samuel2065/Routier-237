<?php

namespace App\Console\Commands;

use App\Enums\ReservationStatus;
use App\Models\Reservation;
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

    public function handle(): int
    {
        $count = Reservation::query()
            ->where('status', ReservationStatus::Pending)
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->update(['status' => ReservationStatus::Expired, 'updated_at' => now()]);

        $this->info("{$count} réservation(s) expirée(s).");

        return self::SUCCESS;
    }
}
