<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Monthly spending limits. category_id null = an overall budget for the scope.
        Schema::create('budgets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('scope', 10)->default('all'); // all | personal | business
            $table->bigInteger('amount'); // pesewas per month
            $table->timestamps();
            $table->unique(['user_id', 'category_id', 'scope']);
        });

        Schema::create('goals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->bigInteger('target_amount'); // pesewas
            $table->date('target_date')->nullable();
            $table->string('color', 9)->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
        });

        Schema::create('goal_contributions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('goal_id')->constrained()->cascadeOnDelete();
            $table->bigInteger('amount'); // pesewas; negative = withdrawal
            $table->date('occurred_on');
            $table->string('note', 255)->nullable();
            $table->timestamps();
            $table->index(['goal_id', 'occurred_on']);
        });

        // An imported MoMo / bank statement for one account and month.
        Schema::create('statements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->char('period', 7); // YYYY-MM
            $table->string('source_name', 255)->nullable();
            $table->bigInteger('opening_balance')->nullable();
            $table->bigInteger('closing_balance')->nullable();
            $table->timestamps();
            $table->unique(['account_id', 'period']);
        });

        Schema::create('statement_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('statement_id')->constrained()->cascadeOnDelete();
            $table->timestamp('occurred_at');
            $table->bigInteger('amount'); // signed pesewas: + money in, - money out
            $table->string('description', 255)->nullable();
            $table->string('reference', 100)->nullable();
            $table->bigInteger('balance')->nullable();
            $table->string('status', 10)->default('unmatched'); // unmatched | matched | ignored
            $table->foreignId('transaction_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
            $table->index(['statement_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('statement_lines');
        Schema::dropIfExists('statements');
        Schema::dropIfExists('goal_contributions');
        Schema::dropIfExists('goals');
        Schema::dropIfExists('budgets');
    }
};
