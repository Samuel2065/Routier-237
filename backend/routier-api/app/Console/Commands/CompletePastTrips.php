<?php

namespace App\Console\Commands;

use App\Enums\TripStatus;
use App\Models\Trip;
use Illuminate\Console\Command;

/**
 * Passe au statut « completed » les trajets publiés des jours précédents
 * (transition published → completed, conservés pour l'historique).
 */
class CompletePastTrips extends Command
{
    protected $signature = 'trips:complete-past';

    protected $description = 'Marque comme terminés les trajets publiés dont la date de départ est passée';

    public function handle(): int
    {
        $count = Trip::query()
            ->where('status', TripStatus::Published)
            ->whereDate('departure_date', '<', today())
            ->update(['status' => TripStatus::Completed, 'updated_at' => now()]);

        $this->info("{$count} trajet(s) marqué(s) comme terminé(s).");

        return self::SUCCESS;
    }
}
