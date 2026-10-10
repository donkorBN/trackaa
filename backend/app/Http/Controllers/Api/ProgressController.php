<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The light gamification layer: daily streaks, levels and badges, all derived
 * from what the user actually did, so there's nothing to fake or farm.
 */
class ProgressController extends Controller
{
    /** Active days needed for each level. */
    private const LEVELS = [
        [0, 'Newcomer'], [3, 'Starter'], [7, 'Tracker'], [14, 'Consistent'], [30, 'Disciplined'],
        [60, 'Money Master'], [100, 'Finance Pro'], [180, 'Legend'], [365, 'Cedi Sensei'],
    ];

    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $tz = $user->timezone ?: 'Africa/Accra';
        $today = CarbonImmutable::now($tz)->startOfDay();

        $days = $user->activityDays()->orderBy('day')->get(['day', 'kind']);
        $set = $days->mapWithKeys(fn ($d) => [$d->day->toDateString() => $d->kind]);

        // Current streak: consecutive active days ending today, or ending yesterday if today
        // hasn't been logged yet (still alive, but at risk).
        $todayDone = $set->has($today->toDateString());
        $cursor = $todayDone ? $today : $today->subDay();
        $streak = 0;
        while ($set->has($cursor->toDateString())) {
            $streak++;
            $cursor = $cursor->subDay();
        }

        $best = 0;
        $run = 0;
        $prev = null;
        foreach ($days as $d) {
            $day = CarbonImmutable::parse($d->day->toDateString(), $tz);
            $run = $prev && $prev->addDay()->equalTo($day) ? $run + 1 : 1;
            $best = max($best, $run);
            $prev = $day;
        }

        $week = [];
        $monday = $today->startOfWeek(CarbonImmutable::MONDAY);
        for ($i = 0; $i < 7; $i++) {
            $d = $monday->addDays($i);
            $week[] = [
                'date' => $d->toDateString(),
                'label' => $d->format('D')[0],
                'state' => $set->get($d->toDateString()) ?? ($d->gt($today) ? 'future' : 'missed'),
            ];
        }

        $active = $days->count();
        $levelIndex = 0;
        foreach (self::LEVELS as $i => [$min]) {
            if ($active >= $min) {
                $levelIndex = $i;
            }
        }
        $next = self::LEVELS[$levelIndex + 1] ?? null;

        $txCount = $user->transactions()->count();
        $badges = [
            ['first_log', 'First entry', 'Record your first transaction', $txCount >= 1, [$txCount, 1]],
            ['streak_3', 'On a roll', 'Log 3 days in a row', $best >= 3, [$best, 3]],
            ['streak_7', 'Week streak', 'Log 7 days in a row', $best >= 7, [$best, 7]],
            ['streak_30', 'Habit locked', 'Log 30 days in a row', $best >= 30, [$best, 30]],
            ['zero_day', 'Zero-spend day', 'Check in on a day you spent nothing', $days->contains('kind', 'checkin'), null],
            ['logs_50', 'Half century', 'Record 50 transactions', $txCount >= 50, [$txCount, 50]],
            ['logs_200', 'Bookkeeper', 'Record 200 transactions', $txCount >= 200, [$txCount, 200]],
            ['planner', 'Planner', 'Set a monthly budget', $user->budgets()->exists(), null],
            ['goal_getter', 'Goal getter', 'Reach a savings goal', $user->goals()->withSum('contributions', 'amount')->get()
                ->contains(fn ($g) => (int) $g->contributions_sum_amount >= $g->target_amount), null],
            ['balanced', 'Balanced books', 'Fully reconcile a statement', $user->statements()->has('lines')
                ->whereDoesntHave('lines', fn ($q) => $q->where('status', 'unmatched'))->exists(), null],
            ['boss', 'Boss move', 'Add a business', $user->businesses()->exists(), null],
        ];

        return response()->json([
            'streak' => $streak,
            'best_streak' => $best,
            'today_done' => $todayDone,
            'at_risk' => ! $todayDone && $streak > 0,
            'week' => $week,
            'active_days' => $active,
            'transactions' => $txCount,
            'level' => [
                'number' => $levelIndex + 1,
                'name' => self::LEVELS[$levelIndex][1],
                'next_name' => $next[1] ?? null,
                'days_into_level' => $active - self::LEVELS[$levelIndex][0],
                'days_for_next' => $next ? $next[0] - self::LEVELS[$levelIndex][0] : null,
            ],
            'badges' => array_map(fn ($b) => [
                'key' => $b[0], 'name' => $b[1], 'description' => $b[2], 'earned' => $b[3],
                'progress' => $b[4] ? ['current' => min($b[4][0], $b[4][1]), 'target' => $b[4][1]] : null,
            ], $badges),
        ]);
    }
}
