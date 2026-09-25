<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Vérifications avant mise en production (§22, §23) : configuration dangereuse ou incomplète.
 * Code de sortie 1 si un point bloquant est détecté.
 */
class CheckProductionReadiness extends Command
{
    protected $signature = 'routier:check-production';

    protected $description = 'Vérifie la configuration avant une mise en production';

    public function handle(): int
    {
        $blocking = [];
        $warnings = [];

        if (! app()->isProduction()) {
            $warnings[] = 'APP_ENV n\'est pas « production » (données de démonstration, simulation de paiement possibles).';
        }
        if (config('app.debug')) {
            $blocking[] = 'APP_DEBUG=true : les erreurs exposeraient des détails internes. Mettre APP_DEBUG=false.';
        }
        if (empty(config('app.key'))) {
            $blocking[] = 'APP_KEY est vide : lancer php artisan key:generate.';
        }
        if (! str_starts_with((string) config('app.url'), 'https://')) {
            $warnings[] = 'APP_URL n\'est pas en HTTPS.';
        }
        foreach ((array) config('cors.allowed_origins') as $origin) {
            if (! str_starts_with((string) $origin, 'https://')) {
                $warnings[] = "Origine CORS non HTTPS : {$origin} (FRONTEND_URL).";
            }
        }
        if (config('payments.driver') === 'mock') {
            $blocking[] = 'PAYMENT_DEFAULT_DRIVER=mock : aucun paiement réel ne serait encaissé (la simulation est refusée en production).';
        }
        if (in_array(config('mail.default'), ['log', 'array'], true)) {
            $warnings[] = 'MAIL_MAILER='.config('mail.default').' : aucun e-mail ne sera envoyé (utiliser resend + RESEND_KEY).';
        }
        if (config('mail.default') === 'resend' && empty(config('services.resend.key'))) {
            $blocking[] = 'MAIL_MAILER=resend sans RESEND_KEY.';
        }

        try {
            DB::connection()->getPdo();
        } catch (Throwable) {
            $blocking[] = 'Connexion à la base de données impossible (DB_*).';
        }

        foreach ($blocking as $message) {
            $this->components->error($message);
        }
        foreach ($warnings as $message) {
            $this->components->warn($message);
        }

        if ($blocking === []) {
            $this->components->info('Aucun point bloquant détecté.'.($warnings === [] ? '' : ' Voir les avertissements ci-dessus.'));

            return self::SUCCESS;
        }

        return self::FAILURE;
    }
}
