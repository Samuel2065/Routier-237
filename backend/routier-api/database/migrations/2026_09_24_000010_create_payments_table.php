<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reservation_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('amount');
            $table->char('currency', 3)->default('XAF');
            $table->string('method', 20);
            $table->string('status', 20)->default('pending')->index();
            // Référence renvoyée par le fournisseur (Orange Money, MTN MoMo, carte).
            $table->string('transaction_reference', 100)->nullable()->unique();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
