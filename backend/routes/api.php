<?php

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BudgetController;
use App\Http\Controllers\Api\BusinessController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\GoalController;
use App\Http\Controllers\Api\InsightsController;
use App\Http\Controllers\Api\OverviewController;
use App\Http\Controllers\Api\ProgressController;
use App\Http\Controllers\Api\StatementController;
use App\Http\Controllers\Api\TransactionController;
use App\Http\Middleware\ExtendTokenLifetime;
use Illuminate\Support\Facades\Route;

Route::get('/meta', [AuthController::class, 'meta']);

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
    Route::delete('/me', [AuthController::class, 'destroy'])->middleware('throttle:10,1');
    Route::put('/me/password', [AuthController::class, 'changePassword'])->middleware('throttle:10,1');
    Route::post('/review', [AuthController::class, 'review']);

    Route::get('/overview', OverviewController::class);
    Route::get('/progress', ProgressController::class);

    Route::get('/transactions/export', [TransactionController::class, 'export']);
    Route::apiResource('transactions', TransactionController::class);
    Route::apiResource('accounts', AccountController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::apiResource('businesses', BusinessController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::apiResource('categories', CategoryController::class)->only(['index', 'store', 'update', 'destroy']);

    Route::get('/insights', InsightsController::class);

    Route::apiResource('budgets', BudgetController::class)->only(['index', 'store', 'update', 'destroy']);

    Route::apiResource('goals', GoalController::class);
    Route::post('/goals/{goal}/contributions', [GoalController::class, 'contribute']);
    Route::delete('/goals/{goal}/contributions/{contribution}', [GoalController::class, 'removeContribution']);

    Route::get('/statements', [StatementController::class, 'index']);
    Route::post('/statements', [StatementController::class, 'store'])->middleware('throttle:20,1');
    Route::get('/statements/{statement}', [StatementController::class, 'show']);
    Route::delete('/statements/{statement}', [StatementController::class, 'destroy']);
    Route::post('/statements/{statement}/rematch', [StatementController::class, 'rematch']);
    Route::patch('/statements/{statement}/lines/{line}', [StatementController::class, 'updateLine']);
    Route::post('/statements/{statement}/lines/{line}/record', [StatementController::class, 'recordLine']);
});
