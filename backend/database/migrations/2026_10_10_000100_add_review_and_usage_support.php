<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->date('last_reviewed_on')->nullable(); // end-of-day review, in the user's timezone
        });
        Schema::table('transactions', function (Blueprint $table) {
            $table->index(['category_id', 'occurred_at']); // category usage ranking for Quick Add
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropIndex(['category_id', 'occurred_at']);
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('last_reviewed_on');
        });
    }
};
