<?php

// Contrôleur frontal de l'API sur Hostinger : la racine du sous-domaine (public_html/api)
// ne contient que ce fichier, son .htaccess et le lien storage ; Laravel est dans
// ../../app/current (lien changé à chaque déploiement).
//
// Les processus PHP du serveur web (LiteSpeed) durent longtemps : leur cache realpath et
// OPcache garderaient l'ancienne version derrière le chemin inchangé « app/current ». Le lien
// est donc relu à chaque requête (readlink() n'est pas mis en cache) et Laravel est chargé
// depuis le chemin propre à la version : une nouvelle version s'applique immédiatement.

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

$link = __DIR__.'/../../app/current';
$target = readlink($link);
if ($target === false) {
    http_response_code(503);
    exit('Service indisponible.');
}
$base = str_starts_with($target, '/') ? $target : dirname($link).'/'.$target;

if (file_exists($maintenance = $base.'/storage/framework/maintenance.php')) {
    require $maintenance;
}

require $base.'/vendor/autoload.php';

/** @var Application $app */
$app = require_once $base.'/bootstrap/app.php';
$app->usePublicPath(__DIR__);

$app->handleRequest(Request::capture());
