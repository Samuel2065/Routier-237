<?php

use App\Http\Middleware\EnsureAccessSpace;
use App\Http\Middleware\ForceJsonResponse;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->api(prepend: [ForceJsonResponse::class]);

        $middleware->alias([
            'space' => EnsureAccessSpace::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Erreurs de l'API toujours en JSON ; les détails internes ne sont exposés
        // que si APP_DEBUG=true (jamais en production).
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
