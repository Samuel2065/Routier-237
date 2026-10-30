<?php

// Démarre une version avec le vrai shared/.env et contrôle les réglages en ligne.
// N'affiche que des lignes OK/FAIL, jamais une valeur du .env.
//   php preflight.php <backend>
// Remplace `php artisan about`, qui a besoin de proc_open (désactivé chez Hostinger).

$base = $argv[1] ?? '';

require $base.'/vendor/autoload.php';
$app = require $base.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$https = fn (string $url) => str_starts_with($url, 'https://');

$checks = [
    'APP_ENV is production or staging' => fn () => app()->environment('production', 'staging'),
    'APP_DEBUG is false' => fn () => config('app.debug') === false,
    'APP_KEY is set' => fn () => filled(config('app.key')),
    'APP_URL is https' => fn () => $https((string) config('app.url')),
    'FRONTEND_URL is https' => fn () => collect(config('cors.allowed_origins'))->isNotEmpty()
        && collect(config('cors.allowed_origins'))->every(fn ($origin) => $https((string) $origin)),
    'BROADCAST_CONNECTION is null (no Reverb on shared hosting)' => fn () => config('broadcasting.default') === 'null',
    'QUEUE_CONNECTION is sync (no worker)' => fn () => config('queue.default') === 'sync',
    'mock payments only outside production' => fn () => ! (app()->isProduction() && config('payments.driver') === 'mock'),
    'Firebase file readable when FCM is on' => fn () => ! config('services.fcm.enabled') || is_readable((string) config('services.fcm.credentials')),
    'storage is writable' => fn () => is_writable(storage_path('framework')) && is_writable(storage_path('logs')),
    'public storage (avatars) is writable' => fn () => is_writable(storage_path('app/public')),
    'database answers' => fn () => Illuminate\Support\Facades\DB::select('select 1 as ok')[0]->ok == 1,
];

$failed = 0;
foreach ($checks as $label => $check) {
    try {
        $ok = (bool) $check();
    } catch (Throwable $e) {
        $ok = false;
    }
    echo $ok ? "  [OK]   $label\n" : "  [FAIL] $label\n";
    $failed += $ok ? 0 : 1;
}

exit($failed > 0 ? 1 : 0);
