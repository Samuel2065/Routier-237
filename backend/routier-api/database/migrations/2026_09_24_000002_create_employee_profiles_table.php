<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_profiles', function (Blueprint $table) {
            $table->id();
            // Un utilisateur interne travaille dans une seule agence.
            $table->foreignId('user_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignId('agency_id')->constrained()->restrictOnDelete();
            $table->string('employee_number', 50);
            $table->date('hired_at')->nullable();
            $table->string('status', 20)->default('active')->index();
            $table->timestamps();

            $table->unique(['agency_id', 'employee_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_profiles');
    }
};
