<?php

/*
|--------------------------------------------------------------------------
| Script de test : une réservation lancée dans un processus PHP séparé
|--------------------------------------------------------------------------
|
| Utilisé par ConcurrentBookingTest pour lancer plusieurs réservations
| réellement simultanées sur le même trajet (connexions MySQL distinctes).
|
| Usage : php book-concurrently.php <trip_id> <user_id> <passagers> <démarrage_microtime>
| Sortie : « OK <référence> » ou « REFUSED <code HTTP> ».
|
*/

use App\Actions\Reservations\CreateReservation;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Symfony\Component\HttpKernel\Exception\HttpException;

require __DIR__.'/../../vendor/autoload.php';

$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

[, $tripId, $userId, $passengerCount, $startAt] = $argv;

// Tous les processus attendent le même instant pour maximiser la concurrence.
while (microtime(true) < (float) $startAt) {
    usleep(500);
}

$passengers = array_fill(0, (int) $passengerCount, [
    'full_name' => 'Passager Concurrent',
    'phone' => null,
    'birth_date' => null,
    'passenger_type' => 'adult',
]);

try {
    $reservation = app(CreateReservation::class)->handle(User::findOrFail($userId), (int) $tripId, $passengers);
    echo 'OK '.$reservation->reference;
} catch (HttpException $exception) {
    echo 'REFUSED '.$exception->getStatusCode();
}
