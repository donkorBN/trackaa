<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Password reset emails link to the Next.js app, not to Laravel.
        ResetPassword::createUrlUsing(function ($user, string $token) {
            $frontend = trim(explode(',', (string) config('app.frontend_url'))[0]);

            return rtrim($frontend, '/').'/reset-password/?'.http_build_query(['token' => $token, 'email' => $user->email]);
        });
    }
}
