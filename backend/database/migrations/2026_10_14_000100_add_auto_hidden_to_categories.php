<?php

use App\Models\User;
use App\Services\BusinessCategories;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->boolean('auto_hidden')->default(false);
        });

        // Existing personal-only users: hide the unused business categories.
        $sync = new BusinessCategories;
        User::query()->each(fn (User $u) => $sync->sync($u));
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->dropColumn('auto_hidden');
        });
    }
};
