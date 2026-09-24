<?php

use App\Http\Controllers\Api\V1\Admin\CityController as AdminCityController;
use App\Http\Controllers\Api\V1\Admin\DirectorController;
use App\Http\Controllers\Api\V1\Agency\EmployeeController;
use App\Http\Controllers\Api\V1\Agency\TripController;
use App\Http\Controllers\Api\V1\Agency\VehicleController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\Management\AgencyController;
use App\Http\Controllers\Api\V1\Management\OrganizationController;
use App\Http\Controllers\Api\V1\Management\RouteController;
use App\Http\Controllers\Api\V1\Public\AgencyController as PublicAgencyController;
use App\Http\Controllers\Api\V1\Public\CityController as PublicCityController;
use App\Http\Controllers\Api\V1\Public\TravelClassController;
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

    // Consultation publique, sans compte.
    Route::get('cities', [PublicCityController::class, 'index'])->name('cities.index');
    Route::get('travel-classes', [TravelClassController::class, 'index'])->name('travel-classes.index');
    Route::get('agencies', [PublicAgencyController::class, 'index'])->name('agencies.index');
    Route::get('agencies/{agency}', [PublicAgencyController::class, 'show'])->name('agencies.show');

    // Session courante, quel que soit l'espace.
    Route::middleware(['auth:sanctum', 'space'])->group(function () {
        Route::get('auth/me', [AuthController::class, 'me'])->name('auth.me');
        Route::post('auth/logout', [AuthController::class, 'logout'])->name('auth.logout');
    });

    // Espace client.
    Route::middleware(['auth:sanctum', 'space:customer'])->prefix('account')->name('account.')->group(function () {
        //
    });

    // Espace agence : director et personnel, limités à leur périmètre par les policies.
    Route::middleware(['auth:sanctum', 'space:agency'])->prefix('agency')->name('agency.')->group(function () {
        Route::apiResource('organizations', OrganizationController::class)->only(['show', 'update']);
        Route::apiResource('agencies', AgencyController::class)->except(['destroy']);
        Route::patch('agencies/{agency}/settings', [AgencyController::class, 'updateSettings'])->name('agencies.settings');
        Route::apiResource('vehicles', VehicleController::class);
        Route::apiResource('employees', EmployeeController::class)->except(['destroy']);
        Route::apiResource('routes', RouteController::class)->only(['index', 'store'])->parameters(['routes' => 'travelRoute']);
        Route::apiResource('trips', TripController::class);
        Route::prefix('trips/{trip}')->name('trips.')->group(function () {
            Route::post('publish', [TripController::class, 'publish'])->name('publish');
            Route::post('unpublish', [TripController::class, 'unpublish'])->name('unpublish');
            Route::post('cancel', [TripController::class, 'cancel'])->name('cancel');
            Route::post('complete', [TripController::class, 'complete'])->name('complete');
        });
    });

    // Espace administrateur de la plateforme.
    Route::middleware(['auth:sanctum', 'space:admin'])->prefix('admin')->name('admin.')->group(function () {
        Route::apiResource('organizations', OrganizationController::class)->except(['destroy']);
        Route::post('organizations/{organization}/directors', [DirectorController::class, 'store'])->name('organizations.directors.store');
        Route::apiResource('agencies', AgencyController::class)->except(['destroy']);
        Route::apiResource('cities', AdminCityController::class)->only(['store', 'update']);
        Route::apiResource('routes', RouteController::class)->except(['show', 'destroy'])->parameters(['routes' => 'travelRoute']);
    });
});
