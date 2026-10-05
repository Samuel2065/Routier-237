<?php

namespace App\Providers;

use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Trip;
use App\Models\User;
use App\Models\Vehicle;
use App\Support\LiveUpdates;
use App\Support\Push\AccessTokenProvider;
use App\Support\Push\GoogleAccessTokenProvider;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Notifications\Messages\MailMessage;
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

        // Notifications push : jeton d'accès Google obtenu avec le compte de service Firebase.
        $this->app->singleton(AccessTokenProvider::class, fn () => new GoogleAccessTokenProvider((string) config('services.fcm.credentials')));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Password::defaults(fn () => Password::min(8)->letters()->numbers());

        $this->registerLiveUpdates();
        $this->configurePasswordResets();

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
     * Lien de réinitialisation du mot de passe : page du frontend React, e-mail en français.
     */
    private function configurePasswordResets(): void
    {
        $resetUrl = function (User $user, string $token): string {
            // Première origine de FRONTEND_URL (déjà analysée pour CORS).
            $frontend = rtrim((string) (config('cors.allowed_origins')[0] ?? 'http://localhost:5173'), '/');

            return $frontend.'/reset-password?'.http_build_query(['token' => $token, 'email' => $user->getEmailForPasswordReset()]);
        };

        ResetPassword::createUrlUsing($resetUrl);

        ResetPassword::toMailUsing(fn (User $user, string $token) => (new MailMessage)
            ->subject('Réinitialisation de votre mot de passe Routier+237')
            ->greeting("Bonjour {$user->name},")
            ->line('Une réinitialisation du mot de passe de votre compte Routier+237 a été demandée.')
            ->action('Choisir un nouveau mot de passe', $resetUrl($user, $token))
            ->line('Ce lien est valable 60 minutes et ne peut servir qu\'une fois.')
            ->line('Si vous n\'êtes pas à l\'origine de cette demande, ignorez ce message : votre mot de passe actuel reste valable.'));
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
