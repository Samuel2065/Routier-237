<?php

namespace App\Console\Commands;

use App\Enums\TripStatus;
use App\Models\Trip;
use App\Support\LiveUpdates;
use Illuminate\Console\Command;

/**
 * Passe au statut « completed » les trajets publiés des jours précédents
 * (transition published → completed, conservés pour l'historique).
 */
class CompletePastTrips extends Command
{
    protected $signature = 'trips:complete-past';

    protected $description = 'Marque comme terminés les trajets publiés dont la date de départ est passée';

    public function handle(LiveUpdates $liveUpdates): int
    {
        $trips = Trip::query()
            ->select(['id', 'agency_id'])
            ->where('status', TripStatus::Published)
            ->whereDate('departure_date', '<', today())
            ->get();

        $count = $trips->isEmpty() ? 0 : Trip::query()
            ->whereKey($trips->modelKeys())
            ->where('status', TripStatus::Published)
            ->update(['status' => TripStatus::Completed, 'updated_at' => now()]);

        // Mise à jour en masse : aucun événement de modèle, signal explicite aux écrans concernés.
        $trips->each(fn (Trip $trip) => $liveUpdates->tripChanged($trip));

        $this->info("{$count} trajet(s) marqué(s) comme terminé(s).");

        return self::SUCCESS;
    }
}
