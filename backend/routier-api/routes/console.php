<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Purge des jetons Sanctum expirés depuis plus de 24 h.
Schedule::command('sanctum:prune-expired --hours=24')->daily();

// Trajets publiés des jours précédents → terminés (historique).
Schedule::command('trips:complete-past')->dailyAt('00:30');
