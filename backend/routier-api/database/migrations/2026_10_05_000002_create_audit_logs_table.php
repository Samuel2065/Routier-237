<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Journal d'audit des actions sensibles (phase 4) : qui a fait quoi, sur quoi, quand.
 *
 * Écriture seule depuis l'application (aucune modification ni suppression par l'API).
 * L'auteur et la cible sont aussi conservés en texte (nom au moment de l'action), pour
 * que le journal reste lisible si le compte ou l'élément change ensuite.
 * Jamais de mot de passe, de jeton ni de secret dans les métadonnées.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_name')->nullable();
            $table->string('actor_role', 32)->nullable();
            $table->string('action', 64)->index();
            $table->string('subject_type', 32)->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->string('subject_label')->nullable();
            $table->json('metadata')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('created_at')->useCurrent()->index();

            $table->index(['subject_type', 'subject_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
