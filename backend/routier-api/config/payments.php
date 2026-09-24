<?php

/*
|--------------------------------------------------------------------------
| Paiements Routier+237 (cahier des charges §10)
|--------------------------------------------------------------------------
|
| driver = « mock » : passerelle simulée (développement et tests), refusée en production.
| driver = « live » : chaque moyen de paiement utilise sa passerelle réelle
|   (app/Payments/Gateways). Tant que les contrats et identifiants de production ne sont pas
|   fournis, ces passerelles répondent 503 « indisponible » : aucune intégration n'est inventée.
|
| Aucun secret n'est codé en dur : tout vient des variables d'environnement.
|
*/

return [

    'driver' => env('PAYMENT_DEFAULT_DRIVER', 'mock'),

    'currency' => 'XAF',

    'mock' => [
        'webhook_secret' => env('PAYMENT_MOCK_WEBHOOK_SECRET'),
    ],

    'orange_money' => [
        'base_url' => env('ORANGE_MONEY_BASE_URL'),
        'merchant_key' => env('ORANGE_MONEY_MERCHANT_KEY'),
        'client_id' => env('ORANGE_MONEY_CLIENT_ID'),
        'client_secret' => env('ORANGE_MONEY_CLIENT_SECRET'),
    ],

    'mtn_momo' => [
        'base_url' => env('MTN_MOMO_BASE_URL'),
        'subscription_key' => env('MTN_MOMO_SUBSCRIPTION_KEY'),
        'api_user' => env('MTN_MOMO_API_USER'),
        'api_key' => env('MTN_MOMO_API_KEY'),
        'environment' => env('MTN_MOMO_ENVIRONMENT', 'sandbox'),
    ],

    'card' => [
        'provider' => env('CARD_PAYMENT_PROVIDER'),
        'public_key' => env('CARD_PAYMENT_PUBLIC_KEY'),
        'secret_key' => env('CARD_PAYMENT_SECRET_KEY'),
        'webhook_secret' => env('CARD_PAYMENT_WEBHOOK_SECRET'),
    ],

];
