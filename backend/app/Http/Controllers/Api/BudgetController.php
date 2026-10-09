<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Budget;
use App\Support\Period;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Monthly budgets, broken down into the daily and weekly amounts they imply.
 * Spending = expenses only (transfers and income never count).
 */
class BudgetController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $tz = Period::timezone($request->query('tz'), $user->timezone);
        $now = CarbonImmutable::now($tz);
        $month = $request->filled('month') ? CarbonImmutable::createFromFormat('!Y-m', (string) $request->query('month'), $tz) : $now->startOfMonth();
        $start = $month->startOfMonth();
        $end = $start->addMonth();
        $days = $start->daysInMonth;
        $isCurrent = $now->gte($start) && $now->lt($end);
        $elapsed = $isCurrent ? $now->day : ($now->gte($end) ? $days : 0);
        $daysLeft = $isCurrent ? $days - $now->day + 1 : ($now->lt($start) ? $days : 0);
        $weekStart = $now->startOfWeek(CarbonImmutable::MONDAY);
        $dayStart = $now->startOfDay();

        $expenses = $user->transactions()->where('type', 'expense')
            ->where('occurred_at', '>=', $start->utc())->where('occurred_at', '<', $end->utc())
            ->get(['amount', 'scope', 'category_id', 'occurred_at']);

        $budgets = $user->budgets()->with('category')->get()->map(function (Budget $b) use ($expenses, $days, $elapsed, $daysLeft, $isCurrent, $weekStart, $dayStart) {
            $mine = $expenses
                ->when($b->scope !== 'all', fn ($c) => $c->where('scope', $b->scope))
                ->when($b->category_id, fn ($c) => $c->where('category_id', $b->category_id));
            $spent = (int) $mine->sum('amount');
            $remaining = $b->amount - $spent;
            $expected = intdiv($b->amount * $elapsed, max($days, 1)); // where you'd be spending evenly

            return [
                'id' => $b->id,
                'category' => $b->category ? ['id' => $b->category->id, 'name' => $b->category->name] : null,
                'scope' => $b->scope,
                'amount' => $b->amount,
                'spent' => $spent,
                'remaining' => $remaining,
                'daily' => intdiv($b->amount, $days),
                'weekly' => intdiv($b->amount * 7, $days),
                'expected_by_now' => $expected,
                'daily_allowance' => $isCurrent && $daysLeft > 0 ? intdiv(max($remaining, 0), $daysLeft) : null,
                'spent_today' => $isCurrent ? (int) $mine->filter(fn ($t) => $t->occurred_at->gte($dayStart))->sum('amount') : null,
                'spent_this_week' => $isCurrent ? (int) $mine->filter(fn ($t) => $t->occurred_at->gte($weekStart))->sum('amount') : null,
            ];
        })->sortBy(fn ($b) => [$b['category'] ? 1 : 0, $b['category']['name'] ?? ''])->values();

        return response()->json([
            'month' => $start->format('Y-m'),
            'days_in_month' => $days,
            'days_elapsed' => $elapsed,
            'days_left' => $daysLeft,
            'data' => $budgets,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $budget = $request->user()->budgets()->updateOrCreate(
            ['category_id' => $data['category_id'] ?? null, 'scope' => $data['scope'] ?? 'all'],
            ['amount' => $data['amount']],
        );

        return response()->json(['id' => $budget->id], 201);
    }

    public function update(Request $request, Budget $budget): JsonResponse
    {
        $this->authorizeOwner($request, $budget);
        $budget->update($request->validate(['amount' => ['required', 'integer', 'min:1', 'max:10000000000000']]));

        return response()->json(['id' => $budget->id]);
    }

    public function destroy(Request $request, Budget $budget): JsonResponse
    {
        $this->authorizeOwner($request, $budget);
        $budget->delete();

        return response()->json(null, 204);
    }

    private function validated(Request $request): array
    {
        $uid = $request->user()->id;

        return $request->validate([
            'category_id' => ['nullable', 'integer', Rule::exists('categories', 'id')->where('user_id', $uid)->where('transaction_type', 'expense')],
            'scope' => ['nullable', Rule::in(['all', 'personal', 'business'])],
            'amount' => ['required', 'integer', 'min:1', 'max:10000000000000'],
        ], ['amount.min' => 'Enter a budget greater than zero.', 'category_id.exists' => 'Budgets apply to expense categories.']);
    }
}
