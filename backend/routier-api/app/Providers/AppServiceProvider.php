<?php

namespace App\Providers;

use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Trip;
use App\Models\Vehicle;
use App\Support\LiveUpdates;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Une collecte de signaux temps réel par requête ou commande.
        $this->app->scoped(LiveUpdates::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Password::defaults(fn () => Password::min(8)->letters()->numbers());

        $this->registerLiveUpdates();

        // Connexion / inscription : 5 tentatives par minute et par couple e-mail + IP.
        RateLimiter::for('auth', function (Request $request) {
            return Limit::perMinute(5)->by(Str::lower((string) $request->input('email')).'|'.$request->ip());
        });

        // Consultation publique (recherche, agences, trajets) : 120 requêtes par minute et par IP.
        RateLimiter::for('public', fn (Request $request) => Limit::perMinute(120)->by($request->ip()));

        // Création de réservations : 10 par minute et par client (évite le blocage abusif de places).
        RateLimiter::for('reservations', fn (Request $request) => Limit::perMinute(10)->by('user:'.$request->user()?->id));

        // Webhooks des fournisseurs de paiement : 300 par minute et par IP.
        RateLimiter::for('webhooks', fn (Request $request) => Limit::perMinute(300)->by($request->ip()));

        // Espaces authentifiés : 300 requêtes par minute et par utilisateur.
        RateLimiter::for('authenticated', fn (Request $request) => Limit::perMinute(300)->by('user:'.($request->user()?->id ?? $request->ip())));
    }

    /**
     * Signaux temps réel : chaque enregistrement d'une réservation, d'un paiement, d'un trajet,
     * d'un véhicule ou d'une notification est signalé aux écrans concernés, en fin de requête.
     * Les mises à jour en masse (expiration, clôture, annulation en cascade) sont signalées
     * explicitement là où elles ont lieu.
     */
    private function registerLiveUpdates(): void
    {
        $live = fn (): LiveUpdates => $this->app->make(LiveUpdates::class);

        Reservation::saved(fn (Reservation $reservation) => $live()->reservationChanged($reservation));
        Payment::saved(fn (Payment $payment) => $live()->paymentChanged($payment));
        Trip::saved(fn (Trip $trip) => $live()->tripChanged($trip));
        Trip::deleted(fn (Trip $trip) => $live()->tripChanged($trip));
        Vehicle::saved(fn (Vehicle $vehicle) => $live()->vehicleChanged($vehicle));
        DatabaseNotification::created(fn (DatabaseNotification $notification) => $live()->notificationCreated($notification));

        $this->app->terminating(fn () => $live()->flush());
    }
}
