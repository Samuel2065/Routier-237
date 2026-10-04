<?php

namespace App\Support;

use App\Events\LiveUpdate;
use App\Models\Agency;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Trip;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Signaux temps réel (Laravel Reverb) : « ces données ont changé, rechargez-les ».
 *
 * Les changements sont collectés pendant la requête (ou la commande), uniquement une fois
 * leur transaction validée, puis envoyés en fin de traitement : un signal par canal, même
 * si cent réservations ont changé. Les signaux ne contiennent que des sujets et des
 * identifiants ; le navigateur relit les données par l'API, qui contrôle les droits.
 *
 * Canaux (autorisations dans routes/channels.php) :
 * - privés : agency.{id} (personnel de l'agence), organization.{id} (director),
 *   user.{id} (le client lui-même), admin (super_admin) ;
 * - public : trips (places disponibles, déjà publiques dans la recherche).
 *
 * Un serveur Reverb arrêté ou absent n'empêche jamais une action : l'échec est journalisé
 * et le frontend se rattrape par interrogation régulière.
 */
class LiveUpdates
{
    /** Au-delà, les identifiants sont omis : le navigateur recharge tout le sujet. */
    private const MAX_IDS = 50;

    /**
     * @var array<string, array{channel: Channel, topics: array<string, true>, ids: array<string, array<int, true>|null>}>
     */
    private array $pending = [];

    /** @var array<int, int> agence de chaque trajet déjà rencontré */
    private array $tripScopes = [];

    /** @var array<int, int|null> */
    private array $agencyOrganizations = [];

    public function reservationChanged(Reservation $reservation): void
    {
        $ids = ['reservation' => $reservation->id, 'trip' => $reservation->trip_id];

        $this->forTrip($reservation->trip_id, ['reservations', 'trips', 'dashboard'], $ids);
        $this->push(new PrivateChannel("user.{$reservation->user_id}"), ['reservations'], ['reservation' => $reservation->id]);
        $this->push(new Channel('trips'), ['availability'], ['trip' => $reservation->trip_id]);
    }

    public function paymentChanged(Payment $payment): void
    {
        $reservation = Reservation::query()->select(['id', 'trip_id', 'user_id'])->find($payment->reservation_id);

        if ($reservation === null) {
            return;
        }

        $ids = ['payment' => $payment->id, 'reservation' => $reservation->id];

        $this->forTrip($reservation->trip_id, ['payments', 'reservations', 'dashboard'], $ids);
        $this->push(new PrivateChannel("user.{$reservation->user_id}"), ['payments', 'reservations'], $ids);
    }

    public function tripChanged(Trip $trip): void
    {
        $this->forAgency($trip->agency_id, ['trips', 'reservations', 'dashboard'], ['trip' => $trip->id]);
        $this->push(new Channel('trips'), ['availability'], ['trip' => $trip->id]);
    }

    /**
     * Capacité ou statut d'un véhicule : tous ses trajets peuvent changer de disponibilité.
     */
    public function vehicleChanged(Vehicle $vehicle): void
    {
        $this->forAgency($vehicle->agency_id, ['vehicles', 'trips', 'dashboard']);
        $this->push(new Channel('trips'), ['availability'], ['trip' => null]);
    }

    public function notificationCreated(DatabaseNotification $notification): void
    {
        if ($notification->notifiable_type === (new User)->getMorphClass()) {
            $this->push(new PrivateChannel("user.{$notification->notifiable_id}"), ['notifications', 'reservations']);
        }
    }

    /**
     * Envoie les signaux collectés (appelé en fin de requête ou de commande).
     */
    public function flush(): void
    {
        $pending = $this->pending;
        $this->pending = [];

        foreach ($pending as $entry) {
            $ids = array_map(
                fn (array $values) => array_keys($values),
                array_filter($entry['ids'], fn (?array $values) => $values !== null && $values !== []),
            );

            rescue(
                fn () => event(new LiveUpdate($entry['channel'], array_keys($entry['topics']), $ids)),
                fn (Throwable $exception) => Log::warning('Temps réel : signal non diffusé.', [
                    'channel' => $entry['channel']->name,
                    'error' => $exception->getMessage(),
                ]),
                report: false,
            );
        }
    }

    /**
     * @param  list<string>  $topics
     * @param  array<string, int|null>  $ids
     */
    private function forTrip(int $tripId, array $topics, array $ids = []): void
    {
        $agencyId = $this->tripScopes[$tripId] ??= (int) Trip::query()->whereKey($tripId)->value('agency_id');

        if ($agencyId > 0) {
            $this->forAgency($agencyId, $topics, $ids);
        }
    }

    /**
     * Personnel de l'agence, director de son organisation et supervision de la plateforme.
     *
     * @param  list<string>  $topics
     * @param  array<string, int|null>  $ids
     */
    private function forAgency(int $agencyId, array $topics, array $ids = []): void
    {
        $organizationId = array_key_exists($agencyId, $this->agencyOrganizations)
            ? $this->agencyOrganizations[$agencyId]
            : $this->agencyOrganizations[$agencyId] = Agency::query()->whereKey($agencyId)->value('organization_id');

        $this->push(new PrivateChannel("agency.$agencyId"), $topics, $ids);

        if ($organizationId !== null) {
            $this->push(new PrivateChannel("organization.$organizationId"), $topics, $ids);
        }

        // La supervision n'a besoin que de savoir que ses indicateurs ont bougé.
        $this->push(new PrivateChannel('admin'), ['dashboard']);
    }

    /**
     * Enregistre le signal une fois la transaction en cours validée (immédiatement hors
     * transaction) : une transaction annulée ne déclenche aucun signal.
     *
     * @param  list<string>  $topics
     * @param  array<string, int|null>  $ids  null : tous les éléments du sujet
     */
    private function push(Channel $channel, array $topics, array $ids = []): void
    {
        DB::afterCommit(function () use ($channel, $topics, $ids) {
            $entry = $this->pending[$channel->name] ?? ['channel' => $channel, 'topics' => [], 'ids' => []];

            foreach ($topics as $topic) {
                $entry['topics'][$topic] = true;
            }

            foreach ($ids as $key => $id) {
                $current = array_key_exists($key, $entry['ids']) ? $entry['ids'][$key] : [];

                if ($current === null || $id === null || count($current) >= self::MAX_IDS) {
                    $entry['ids'][$key] = null;
                } else {
                    $current[$id] = true;
                    $entry['ids'][$key] = $current;
                }
            }

            $this->pending[$channel->name] = $entry;
        });
    }
}
