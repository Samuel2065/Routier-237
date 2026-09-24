<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained()->restrictOnDelete();
            // Un véhicule appartient à une seule classe : VIP et Classique ne sont jamais
            // deux zones d'un même véhicule (cahier des charges §7.2).
            $table->foreignId('travel_class_id')->constrained()->restrictOnDelete();
            $table->string('registration_number', 30)->unique();
            $table->string('brand', 60);
            $table->string('model', 60);
            // Capacité réelle : seule source de la capacité des trajets.
            $table->unsignedSmallInteger('capacity');
            $table->json('amenities')->nullable();
            $table->string('status', 20)->default('active')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicles');
    }
};
