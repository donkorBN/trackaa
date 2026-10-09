<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

/**
 * Tokens expire after 90 days of not being used. Each day you use the app the
 * window slides forward, so active users stay logged in.
 */
class ExtendTokenLifetime
{
    public const DAYS = 90;

    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->user()?->currentAccessToken();
        if ($token instanceof PersonalAccessToken && $token->expires_at && $token->expires_at->lt(now()->addDays(self::DAYS - 1))) {
            $token->forceFill(['expires_at' => now()->addDays(self::DAYS)])->save();
        }

        return $next($request);
    }
}
