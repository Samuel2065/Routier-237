<?php

/*
|--------------------------------------------------------------------------
| Paramètres métier Routier+237
|--------------------------------------------------------------------------
*/

return [

    'reservations' => [
        // Durée pendant laquelle une réservation en attente de paiement bloque ses places (§8).
        'pending_ttl_minutes' => (int) env('RESERVATION_PENDING_TTL_MINUTES', 15),

        // Nombre maximal de passagers par réservation.
        'max_passengers' => 20,
    ],

];
