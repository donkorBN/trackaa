<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use App\Services\Ledger;
use App\Support\Period;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TransactionController extends Controller
{
    private const RELATIONS = ['business', 'category', 'account', 'toAccount'];

    public function index(Request $request, Ledger $ledger): JsonResponse
    {
        $user = $request->user();
        $tz = Period::timezone($request->query('tz'), $user->timezone);
        $q = $ledger->filtered($user, $request);
        if ($request->filled('from') || $request->filled('to')) {
            $ledger->within($q, Period::dates($request->query('from'), $request->query('to'), $tz));
        }

        $perPage = min(max((int) $request->query('per_page', 50), 1), 200);
        $page = (clone $q)->with(self::RELATIONS)
            ->orderByDesc('occurred_at')->orderByDesc('id')
            ->paginate($perPage);

        return response()->json([
            'data' => collect($page->items())->map->toApi(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
            'days' => $this->dailyTotals($q, collect($page->items()), $tz),
        ]);
    }

    public function show(Request $request, Transaction $transaction): JsonResponse
    {
        $this->authorizeOwner($request, $transaction);

        return response()->json($transaction->load(self::RELATIONS)->toApi());
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $this->validated($request, []);

        // Idempotency: a retried/double-tapped submit with the same client_ref returns the original.
        if (! empty($data['client_ref'])) {
            $existing = $user->transactions()->where('client_ref', $data['client_ref'])->first();
            if ($existing) {
                return response()->json($existing->load(self::RELATIONS)->toApi(), 200);
            }
        }

        try {
            $tx = $user->transactions()->create($data);
        } catch (UniqueConstraintViolationException) {
            $tx = $user->transactions()->where('client_ref', $data['client_ref'])->firstOrFail();
        }

        return response()->json($tx->load(self::RELATIONS)->toApi(), 201);
    }

    public function update(Request $request, Transaction $transaction): JsonResponse
    {
        $this->authorizeOwner($request, $transaction);
        $current = $transaction->only([
            'type', 'amount', 'scope', 'business_id', 'category_id', 'account_id', 'to_account_id', 'description',
        ]);
        $current['occurred_at'] = $transaction->occurred_at->toIso8601String();

        $transaction->update($this->validated($request, $current));

        return response()->json($transaction->refresh()->load(self::RELATIONS)->toApi());
    }

    public function destroy(Request $request, Transaction $transaction): JsonResponse
    {
        $this->authorizeOwner($request, $transaction);
        $transaction->delete();

        return response()->json(null, 204);
    }

    /**
     * Validate the full (merged) record. Every referenced account, category and
     * business must belong to the current user.
     */
    private function validated(Request $request, array $current): array
    {
        $uid = $request->user()->id;
        $input = array_merge($current, $request->only([
            'type', 'amount', 'scope', 'business_id', 'category_id', 'account_id',
            'to_account_id', 'description', 'occurred_at', 'client_ref',
        ]));
        $type = $input['type'] ?? null;

        if ($type === 'transfer') {
            $input['category_id'] = null;
        } else {
            $input['to_account_id'] = null;
        }
        if (($input['scope'] ?? null) === 'personal') {
            $input['business_id'] = null;
        }

        $owned = fn (string $table) => Rule::exists($table, 'id')->where('user_id', $uid);

        $data = validator($input, [
            'type' => ['required', Rule::in(Transaction::TYPES)],
            'amount' => ['required', 'integer', 'min:1', 'max:10000000000000'],
            'scope' => ['required', Rule::in(Transaction::SCOPES)],
            'business_id' => ['nullable', 'integer', $owned('businesses')],
            'category_id' => [
                Rule::requiredIf($type !== 'transfer'), 'nullable', 'integer',
                Rule::exists('categories', 'id')->where('user_id', $uid)->where('transaction_type', $type),
            ],
            'account_id' => ['required', 'integer', $owned('accounts')],
            'to_account_id' => [Rule::requiredIf($type === 'transfer'), 'nullable', 'integer', 'different:account_id', $owned('accounts')],
            'description' => ['nullable', 'string', 'max:255'],
            'occurred_at' => ['nullable', 'date'],
            'client_ref' => ['nullable', 'uuid'],
        ], [
            'amount.min' => 'Enter an amount greater than zero.',
            'category_id.required' => 'Pick a category.',
            'category_id.exists' => 'Pick a category that matches the transaction type.',
            'to_account_id.required' => 'Pick the account the money moved to.',
            'to_account_id.different' => 'A transfer needs two different accounts.',
        ])->validate();

        $data['occurred_at'] = isset($data['occurred_at'])
            ? CarbonImmutable::parse($data['occurred_at'])->utc()
            : CarbonImmutable::now('UTC');
        $data['description'] = isset($data['description']) ? (trim($data['description']) ?: null) : null;
        if (! $request->has('client_ref')) {
            unset($data['client_ref']);
        }

        return $data;
    }

    /** Income/expense subtotals for each local day shown on this page (across the full filter). */
    private function dailyTotals($q, $items, string $tz): array
    {
        if ($items->isEmpty()) {
            return [];
        }
        $start = $items->min('occurred_at')->setTimezone($tz)->startOfDay()->utc();
        $end = $items->max('occurred_at')->setTimezone($tz)->startOfDay()->addDay()->utc();

        $days = [];
        (clone $q)->where('occurred_at', '>=', $start)->where('occurred_at', '<', $end)
            ->whereIn('type', ['income', 'expense'])
            ->reorder()
            ->select(['type', 'amount', 'occurred_at'])
            ->each(function ($t) use (&$days, $tz) {
                $key = $t->occurred_at->setTimezone($tz)->toDateString();
                $days[$key] ??= ['income' => 0, 'expense' => 0];
                $days[$key][$t->type] += $t->amount;
            });

        return $days;
    }
}
