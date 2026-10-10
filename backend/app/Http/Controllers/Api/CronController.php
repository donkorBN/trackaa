<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;

/**
 * For hosts without a built-in scheduler (e.g. Render's free plan): a free external
 * pinger such as cron-job.org calls this every few minutes with the secret. Each call
 * sends any due daily reminders and keeps the service awake.
 */
class CronController extends Controller
{
    public function reminders(Request $request): JsonResponse
    {
        $secret = (string) config('services.cron.secret');
        $given = (string) ($request->bearerToken() ?? $request->query('token', ''));
        abort_unless($secret !== '' && hash_equals($secret, $given), 404);

        Artisan::call('reminders:send');

        return response()->json(['ok' => true, 'output' => trim(Artisan::output())]);
    }
}
