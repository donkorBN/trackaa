<?php

use App\Http\Middleware\ForceJson;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Hosting platforms (Railway, Render, Fly, Laravel Cloud...) put the app behind a proxy.
        // Trust its X-Forwarded-* headers so rate limits see the real client IP and URLs use https.
        $middleware->trustProxies(at: env('TRUSTED_PROXIES', '*'));
        $middleware->prependToGroup('api', ForceJson::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
