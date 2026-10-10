<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Notifications were removed from the product.
        Schema::dropIfExists('push_subscriptions');
        Schema::dropIfExists('app_settings');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['reminder_enabled', 'reminder_time', 'last_reminded_on']);
        });

        // One row per local day the user showed up: logged a transaction or checked in
        // ("no spending today" / end-of-day review). Streaks are built from this.
        Schema::create('activity_days', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('day');
            $table->string('kind', 10)->default('logged'); // logged | checkin
            $table->timestamps();
            $table->unique(['user_id', 'day']);
        });

        // Backfill from existing transactions (created dates, user's timezone approximated as UTC+0 / Accra).
        $rows = DB::table('transactions')
            ->selectRaw('user_id, MIN(created_at) AS first_at, DATE(created_at) AS day')
            ->groupBy('user_id', DB::raw('DATE(created_at)'))
            ->get();
        foreach ($rows as $r) {
            DB::table('activity_days')->insertOrIgnore([
                'user_id' => $r->user_id, 'day' => $r->day, 'kind' => 'logged', 'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        // Businesses used to be pre-filled for everyone. Remove those placeholders where nobody used them.
        DB::table('businesses')
            ->whereIn('name', ['MachineWura', 'MediaWura', 'SneakersInn', 'Paylead', 'Other'])
            ->whereNotExists(fn ($q) => $q->select(DB::raw(1))->from('transactions')->whereColumn('transactions.business_id', 'businesses.id'))
            ->delete();
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_days');
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('reminder_enabled')->default(true);
            $table->string('reminder_time', 5)->default('20:00');
            $table->date('last_reminded_on')->nullable();
        });
    }
};
