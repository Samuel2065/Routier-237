<?php

use App\Http\Controllers\Api\V1\AuthController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routier+237 — v1
|--------------------------------------------------------------------------
|
| Authentification : jetons Bearer Sanctum limités à un espace (client, agence,
| administrateur). Le middleware « space » vérifie l'espace du jeton et que le
| compte est toujours actif ; les policies vérifient permissions et périmètre.
|
*/

Route::prefix('v1')->name('api.v1.')->group(function () {
    // Authentification (publique, limitée en fréquence).
    Route::middleware('throttle:auth')->group(function () {
        Route::post('auth/register', [AuthController::class, 'register'])->name('auth.register');
        Route::post('auth/login', [AuthController::class, 'loginCustomer'])->name('auth.login');
        Route::post('agency/auth/login', [AuthController::class, 'loginAgency'])->name('agency.auth.login');
        Route::post('admin/auth/login', [AuthController::class, 'loginAdmin'])->name('admin.auth.login');
    });

    // Session courante, quel que soit l'espace.
    Route::middleware(['auth:sanctum', 'space'])->group(function () {
        Route::get('auth/me', [AuthController::class, 'me'])->name('auth.me');
        Route::post('auth/logout', [AuthController::class, 'logout'])->name('auth.logout');
    });

    // Espaces privés : les modules suivants ajoutent leurs routes dans ces groupes.
    Route::middleware(['auth:sanctum', 'space:customer'])->prefix('account')->name('account.')->group(function () {
        //
    });

    Route::middleware(['auth:sanctum', 'space:agency'])->prefix('agency')->name('agency.')->group(function () {
        //
    });

    Route::middleware(['auth:sanctum', 'space:admin'])->prefix('admin')->name('admin.')->group(function () {
        //
    });
});
