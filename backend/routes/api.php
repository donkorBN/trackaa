<?php

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BusinessController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\OverviewController;
use App\Http\Controllers\Api\PushController;
use App\Http\Controllers\Api\TransactionController;
use Illuminate\Support\Facades\Route;

Route::middleware('throttle:10,1')->group(function () {
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::patch('/me', [AuthController::class, 'update']);

    Route::get('/overview', OverviewController::class);

    Route::apiResource('transactions', TransactionController::class);
    Route::apiResource('accounts', AccountController::class)->only(['index', 'store', 'update']);
    Route::apiResource('businesses', BusinessController::class)->only(['index', 'store', 'update']);
    Route::apiResource('categories', CategoryController::class)->only(['index', 'store', 'update']);

    Route::get('/push/key', [PushController::class, 'key']);
    Route::post('/push/subscribe', [PushController::class, 'subscribe']);
    Route::delete('/push/subscribe', [PushController::class, 'unsubscribe']);
});
