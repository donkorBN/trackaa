<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Ledger;
use App\Support\Period;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OverviewController extends Controller
{
    public function __invoke(Request $request, Ledger $ledger): JsonResponse
    {
        $user = $request->user();
        $tz = Period::timezone($request->query('tz'), $user->timezone);
        $base = $ledger->filtered($user, $request);
        $period = Period::named((string) $request->query('period', 'month'), $request->query('from'), $request->query('to'), $tz);

        $inPeriod = $ledger->within(clone $base, $period);
        $showBusinesses = $request->query('scope') !== 'personal';

        return response()->json([
            'today' => $ledger->totals($ledger->within(clone $base, Period::today($tz))),
            'month' => $ledger->totals($ledger->within(clone $base, Period::month($tz))),
            'period' => $ledger->totals($inPeriod) + $period->toArray(),
            'categories' => $ledger->expenseByCategory($inPeriod),
            'businesses' => $showBusinesses ? $ledger->byBusiness($inPeriod) : [],
            'recent' => (clone $base)->with(['business', 'category', 'account', 'toAccount'])
                ->orderByDesc('occurred_at')->orderByDesc('id')->limit(5)->get()->map->toApi(),
            'has_transactions' => $user->transactions()->exists(),
        ]);
    }
}
