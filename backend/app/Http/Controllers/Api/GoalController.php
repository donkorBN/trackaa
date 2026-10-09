<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Goal;
use App\Models\GoalContribution;
use App\Support\Period;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GoalController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = $request->user()->goals()->with('contributions')->orderBy('id');
        if (! $request->boolean('include_archived')) {
            $q->active();
        }
        $tz = Period::timezone($request->query('tz'), $request->user()->timezone);

        return response()->json(['data' => $q->get()->map(fn (Goal $g) => $this->present($g, $tz))]);
    }

    public function show(Request $request, Goal $goal): JsonResponse
    {
        $this->authorizeOwner($request, $goal);
        $tz = Period::timezone($request->query('tz'), $request->user()->timezone);
        $goal->load('contributions');

        $running = 0;
        $history = $goal->contributions->sortBy([['occurred_on', 'asc'], ['id', 'asc']])->values()->map(function (GoalContribution $c) use (&$running) {
            $running += $c->amount;

            return ['id' => $c->id, 'amount' => $c->amount, 'occurred_on' => $c->occurred_on->toDateString(), 'note' => $c->note, 'running_total' => $running];
        });

        return response()->json($this->present($goal, $tz) + ['contributions' => $history->reverse()->values()]);
    }

    public function store(Request $request): JsonResponse
    {
        $goal = $request->user()->goals()->create($this->validated($request, true));

        return response()->json($this->present($goal->load('contributions'), $request->user()->timezone), 201);
    }

    public function update(Request $request, Goal $goal): JsonResponse
    {
        $this->authorizeOwner($request, $goal);
        $goal->fill($this->validated($request, false));
        if ($request->has('archived')) {
            $goal->setArchived($request->boolean('archived'));
        }
        $goal->save();

        return response()->json($this->present($goal->load('contributions'), $request->user()->timezone));
    }

    public function destroy(Request $request, Goal $goal): JsonResponse
    {
        $this->authorizeOwner($request, $goal);
        $goal->delete();

        return response()->json(null, 204);
    }

    public function contribute(Request $request, Goal $goal): JsonResponse
    {
        $this->authorizeOwner($request, $goal);
        $data = $request->validate([
            'amount' => ['required', 'integer', 'not_in:0', 'between:-10000000000000,10000000000000'],
            'occurred_on' => ['nullable', 'date_format:Y-m-d'],
            'note' => ['nullable', 'string', 'max:255'],
        ], ['amount.not_in' => 'Enter an amount.']);
        $data['occurred_on'] ??= CarbonImmutable::now($request->user()->timezone)->toDateString();
        $goal->contributions()->create($data);

        return $this->show($request, $goal);
    }

    public function removeContribution(Request $request, Goal $goal, GoalContribution $contribution): JsonResponse
    {
        $this->authorizeOwner($request, $goal);
        abort_unless($contribution->goal_id === $goal->id, 404);
        $contribution->delete();

        return $this->show($request, $goal);
    }

    private function validated(Request $request, bool $creating): array
    {
        $req = $creating ? 'required' : 'sometimes';

        return $request->validate([
            'name' => [$req, 'string', 'max:80'],
            'target_amount' => [$req, 'integer', 'min:1', 'max:10000000000000'],
            'target_date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'color' => ['sometimes', 'nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ]);
    }

    /** Progress, what's needed per week/month to hit the date, and a projection from recent pace. */
    private function present(Goal $g, string $tz): array
    {
        $saved = (int) $g->contributions->sum('amount');
        $remaining = max($g->target_amount - $saved, 0);
        $today = CarbonImmutable::now($tz)->startOfDay();

        $monthlyNeeded = $weeklyNeeded = null;
        if ($g->target_date && $remaining > 0) {
            $daysLeft = max((int) $today->diffInDays(CarbonImmutable::parse($g->target_date->toDateString(), $tz), false), 1);
            $weeklyNeeded = (int) ceil($remaining * 7 / $daysLeft);
            $monthlyNeeded = (int) ceil($remaining * 30.4375 / $daysLeft);
        }

        // Pace = net saved over the last 90 days (or since the first contribution, if sooner).
        $projected = null;
        $first = $g->contributions->min('occurred_on');
        if ($remaining > 0 && $first) {
            $since = CarbonImmutable::parse($first->toDateString(), $tz)->max($today->subDays(90));
            $recent = (int) $g->contributions->filter(fn ($c) => $c->occurred_on->gte($since))->sum('amount');
            $span = max((int) $since->diffInDays($today) + 1, 7);
            if ($recent > 0) {
                $projected = $today->addDays((int) ceil($remaining * $span / $recent))->toDateString();
            }
        }

        return [
            'id' => $g->id,
            'name' => $g->name,
            'target_amount' => $g->target_amount,
            'target_date' => $g->target_date?->toDateString(),
            'color' => $g->color,
            'archived' => $g->isArchived(),
            'saved' => $saved,
            'remaining' => $remaining,
            'percent' => $g->target_amount > 0 ? min(100, (int) floor($saved * 100 / $g->target_amount)) : 0,
            'weekly_needed' => $weeklyNeeded,
            'monthly_needed' => $monthlyNeeded,
            'projected_date' => $projected,
            'on_track' => $projected && $g->target_date ? $projected <= $g->target_date->toDateString() : null,
            'contribution_count' => $g->contributions->count(),
        ];
    }
}
