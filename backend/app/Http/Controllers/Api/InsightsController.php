<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Ledger;
use App\Support\Period;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Trends and patterns: month-by-month cash flow, daily spending this month,
 * weekday habits, and which categories moved versus last month.
 */
class InsightsController extends Controller
{
    private const WEEKDAYS = [1 => 'Mon', 2 => 'Tue', 3 => 'Wed', 4 => 'Thu', 5 => 'Fri', 6 => 'Sat', 7 => 'Sun'];

    public function __invoke(Request $request, Ledger $ledger): JsonResponse
    {
        $user = $request->user();
        $tz = Period::timezone($request->query('tz'), $user->timezone);
        $months = min(max((int) $request->query('months', 6), 3), 24);
        $now = CarbonImmutable::now($tz);
        $thisMonth = $now->startOfMonth();
        $from = $thisMonth->subMonths($months - 1);
        $patternFrom = $now->startOfDay()->subDays(89); // 90-day window for weekday habits

        $txs = $ledger->filtered($user, $request)
            ->whereIn('type', ['income', 'expense'])
            ->where('occurred_at', '>=', $from->min($patternFrom)->utc())
            ->with('category:id,name')
            ->get(['id', 'type', 'amount', 'category_id', 'occurred_at', 'description'])
            ->each(fn ($t) => $t->local = $t->occurred_at->setTimezone($tz));

        // Month-by-month cash flow.
        $monthly = [];
        for ($m = $from; $m->lte($thisMonth); $m = $m->addMonth()) {
            $monthly[$m->format('Y-m')] = ['month' => $m->format('Y-m'), 'income' => 0, 'expense' => 0, 'net' => 0];
        }
        foreach ($txs as $t) {
            $k = $t->local->format('Y-m');
            if (isset($monthly[$k])) {
                $monthly[$k][$t->type] += $t->amount;
            }
        }
        foreach ($monthly as &$row) {
            $row['net'] = $row['income'] - $row['expense'];
        }
        unset($row);

        // Daily spending this month.
        $daily = [];
        for ($d = $thisMonth; $d->lt($thisMonth->addMonth()); $d = $d->addDay()) {
            $daily[$d->toDateString()] = ['date' => $d->toDateString(), 'expense' => 0, 'income' => 0];
        }
        $inMonth = $txs->filter(fn ($t) => $t->local->gte($thisMonth));
        foreach ($inMonth as $t) {
            $daily[$t->local->toDateString()][$t->type] += $t->amount;
        }

        // Weekday pattern: average spend per weekday over the last 90 days.
        $weekdays = [];
        foreach (self::WEEKDAYS as $iso => $label) {
            $weekdays[$iso] = ['weekday' => $iso, 'label' => $label, 'total' => 0, 'average' => 0, 'days' => 0];
        }
        for ($d = $patternFrom; $d->lte($now); $d = $d->addDay()) {
            $weekdays[$d->dayOfWeekIso]['days']++;
        }
        foreach ($txs as $t) {
            if ($t->type === 'expense' && $t->local->gte($patternFrom)) {
                $weekdays[$t->local->dayOfWeekIso]['total'] += $t->amount;
            }
        }
        foreach ($weekdays as &$w) {
            $w['average'] = $w['days'] ? intdiv($w['total'], $w['days']) : 0;
        }
        unset($w);

        // Categories this month vs the same point last month (fair comparison mid-month).
        $lastStart = $thisMonth->subMonth();
        $lastCutoff = $lastStart->addDays(min($now->day, $lastStart->daysInMonth))->setTimeFrom($now);
        $byCat = [];
        foreach ($txs as $t) {
            if ($t->type !== 'expense' || ! $t->category) {
                continue;
            }
            $key = $t->category_id;
            $byCat[$key] ??= ['id' => $t->category_id, 'name' => $t->category->name, 'this_month' => 0, 'last_month_to_date' => 0, 'last_month' => 0];
            if ($t->local->gte($thisMonth)) {
                $byCat[$key]['this_month'] += $t->amount;
            } elseif ($t->local->gte($lastStart)) {
                $byCat[$key]['last_month'] += $t->amount;
                if ($t->local->lt($lastCutoff)) {
                    $byCat[$key]['last_month_to_date'] += $t->amount;
                }
            }
        }
        $categories = collect($byCat)
            ->filter(fn ($c) => $c['this_month'] > 0 || $c['last_month_to_date'] > 0)
            ->map(fn ($c) => $c + ['change' => $c['this_month'] - $c['last_month_to_date']])
            ->sortByDesc(fn ($c) => $c['this_month'])->values();

        $monthExpense = $monthly[$thisMonth->format('Y-m')]['expense'];
        $monthIncome = $monthly[$thisMonth->format('Y-m')]['income'];
        $avgDaily = intdiv($monthExpense, max($now->day, 1));
        $previous = array_slice(array_values($monthly), 0, -1);
        $withData = array_filter($previous, fn ($m) => $m['income'] || $m['expense']);

        return response()->json([
            'months' => array_values($monthly),
            'daily' => array_values($daily),
            'weekdays' => array_values($weekdays),
            'categories' => $categories,
            'top_expenses' => $inMonth->where('type', 'expense')->sortByDesc('amount')->take(5)->values()->map(fn ($t) => [
                'id' => $t->id, 'amount' => $t->amount, 'description' => $t->description,
                'category' => $t->category?->name, 'occurred_at' => $t->occurred_at->toIso8601ZuluString(),
            ]),
            'stats' => [
                'average_daily_spend' => $avgDaily,
                'projected_month_spend' => $avgDaily * $thisMonth->daysInMonth,
                'savings_rate' => $monthIncome > 0 ? round(($monthIncome - $monthExpense) * 100 / $monthIncome, 1) : null,
                'average_monthly_spend' => $withData ? intdiv(array_sum(array_column($withData, 'expense')), count($withData)) : null,
                'average_monthly_income' => $withData ? intdiv(array_sum(array_column($withData, 'income')), count($withData)) : null,
                'day_of_month' => $now->day,
                'days_in_month' => $thisMonth->daysInMonth,
            ],
        ]);
    }
}
