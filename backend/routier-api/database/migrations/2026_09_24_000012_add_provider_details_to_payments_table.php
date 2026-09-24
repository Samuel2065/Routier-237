<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Informations nécessaires au suivi des paiements par passerelle :
 * passerelle utilisée, numéro débité (mobile money) et motif d'échec.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->string('provider', 30)->nullable()->after('method');
            $table->string('payer_phone', 30)->nullable()->after('provider');
            $table->string('failure_reason')->nullable()->after('paid_at');
            $table->index(['reservation_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex(['reservation_id', 'status']);
            $table->dropColumn(['provider', 'payer_phone', 'failure_reason']);
        });
    }
};
