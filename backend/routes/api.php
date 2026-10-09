<?php

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BusinessController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\OverviewController;
use App\Http\Controllers\Api\PushController;
use App\Http\Controllers\Api\TransactionController;
use App\Http\Middleware\ExtendTokenLifetime;
use Illuminate\Support\Facades\Route;

Route::middleware('throttle:10,1')->group(function () {
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);
});

Route::middleware(['auth:sanctum', ExtendTokenLifetime::class])->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::patch('/me', [AuthController::class, 'update']);
    Route::put('/me/password', [AuthController::class, 'changePassword'])->middleware('throttle:10,1');
    Route::post('/review', [AuthController::class, 'review']);

    Route::get('/overview', OverviewController::class);

    Route::get('/transactions/export', [TransactionController::class, 'export']);
    Route::apiResource('transactions', TransactionController::class);
    Route::apiResource('accounts', AccountController::class)->only(['index', 'store', 'update']);
    Route::apiResource('businesses', BusinessController::class)->only(['index', 'store', 'update']);
    Route::apiResource('categories', CategoryController::class)->only(['index', 'store', 'update']);

    Route::get('/push/key', [PushController::class, 'key']);
    Route::post('/push/subscribe', [PushController::class, 'subscribe']);
    Route::delete('/push/subscribe', [PushController::class, 'unsubscribe']);
});
