<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trips', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained()->restrictOnDelete();
            $table->foreignId('route_id')->constrained()->restrictOnDelete();
            $table->foreignId('vehicle_id')->constrained()->restrictOnDelete();
            $table->foreignId('travel_class_id')->constrained()->restrictOnDelete();
            $table->date('departure_date');
            $table->time('departure_time');
            // Montant en FCFA (XAF, sans subdivision).
            $table->unsignedInteger('price');
            $table->string('status', 20)->default('draft');
            $table->timestamps();

            // Pas de colonne de capacité ni de places restantes : elles sont calculées
            // à partir du véhicule et des réservations valides (cahier des charges §8).
            $table->index(['route_id', 'departure_date', 'status']);
            $table->index(['agency_id', 'departure_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trips');
    }
};
