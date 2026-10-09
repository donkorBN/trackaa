<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('timezone')->default('Africa/Accra');
            $table->boolean('reminder_enabled')->default(true);
            $table->string('reminder_time', 5)->default('20:00'); // HH:MM in the user's timezone
            $table->date('last_reminded_on')->nullable();
        });

        Schema::create('accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->string('account_type', 20); // mobile_money | cash | bank | other
            // Money is stored as integer pesewas (GH₵ 1.00 = 100).
            $table->bigInteger('opening_balance')->default(0);
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'archived_at']);
        });

        Schema::create('businesses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'archived_at']);
        });

        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            // Nullable to allow future shared system categories; defaults are
            // currently copied to each user so they can be renamed/archived.
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->string('transaction_type', 10); // income | expense
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'transaction_type']);
        });

        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 10); // income | expense | transfer
            $table->bigInteger('amount'); // positive integer pesewas
            $table->string('scope', 10); // personal | business
            $table->foreignId('business_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('category_id')->nullable()->constrained()->restrictOnDelete(); // null only for transfers
            $table->foreignId('account_id')->constrained()->restrictOnDelete(); // source for transfers
            $table->foreignId('to_account_id')->nullable()->constrained('accounts')->restrictOnDelete(); // transfers only
            $table->string('description', 255)->nullable();
            $table->timestamp('occurred_at');
            $table->uuid('client_ref')->nullable(); // idempotency key from the client
            $table->timestamps();

            $table->index(['user_id', 'occurred_at']);
            $table->unique(['user_id', 'client_ref']);
        });

        Schema::create('push_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('endpoint', 500)->unique();
            $table->string('public_key');
            $table->string('auth_token');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('push_subscriptions');
        Schema::dropIfExists('transactions');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('businesses');
        Schema::dropIfExists('accounts');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['timezone', 'reminder_enabled', 'reminder_time', 'last_reminded_on']);
        });
    }
};
