<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Production needs no seed data: each user gets their default categories,
     * accounts and businesses when they register. For local sample data run:
     *   php artisan db:seed --class=DemoSeeder
     */
    public function run(): void {}
}
