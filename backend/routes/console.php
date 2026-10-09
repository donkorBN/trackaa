<?php

use Illuminate\Support\Facades\Schedule;

// Requires the scheduler: `php artisan schedule:work` locally, or a cron entry running
// `php artisan schedule:run` every minute in production.
Schedule::command('reminders:send')->everyMinute()->withoutOverlapping();
