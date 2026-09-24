<?php

namespace App\Notifications;

use App\Models\Reservation;

/**
 * Résumé lisible du trajet d'une réservation, pour les notifications.
 */
final class TripSummary
{
    public static function for(Reservation $reservation): string
    {
        $trip = $reservation->trip->loadMissing(['route.departureCity', 'route.destinationCity', 'agency']);

        return sprintf(
            'Trajet %s → %s le %s à %s (%s).',
            $trip->route->departureCity->name,
            $trip->route->destinationCity->name,
            $trip->departure_date->format('d/m/Y'),
            substr($trip->departure_time, 0, 5),
            $trip->agency->name,
        );
    }
}
