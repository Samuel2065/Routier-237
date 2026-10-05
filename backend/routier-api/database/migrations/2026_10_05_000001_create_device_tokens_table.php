<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Jetons d'appareil Firebase Cloud Messaging (notifications push, phase 3b).
 *
 * Un jeton = un navigateur d'un appareil, rattaché au compte et au jeton de connexion
 * Sanctum qui l'a enregistré : une déconnexion, une suspension (jetons révoqués) ou
 * l'expiration de la session supprime l'appareil en cascade, plus aucun push n'y part.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('device_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('personal_access_token_id')->constrained()->cascadeOnDelete();
            // Jeton FCM (longueur non garantie par Google) et son empreinte pour l'unicité.
            $table->text('token');
            $table->char('token_hash', 64)->unique();
            $table->string('user_agent', 255)->nullable();
            $table->timestamp('last_registered_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('device_tokens');
    }
};
