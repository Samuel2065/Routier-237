<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
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
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Password::defaults(fn () => Password::min(8)->letters()->numbers());

        // Connexion / inscription : 5 tentatives par minute et par couple e-mail + IP.
        RateLimiter::for('auth', function (Request $request) {
            return Limit::perMinute(5)->by(Str::lower((string) $request->input('email')).'|'.$request->ip());
        });

        // Consultation publique (recherche, agences, trajets) : 120 requêtes par minute et par IP.
        RateLimiter::for('public', fn (Request $request) => Limit::perMinute(120)->by($request->ip()));

        // Création de réservations : 10 par minute et par client (évite le blocage abusif de places).
        RateLimiter::for('reservations', fn (Request $request) => Limit::perMinute(10)->by('user:'.$request->user()?->id));
    }
}
