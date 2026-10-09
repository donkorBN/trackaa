<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Statement;
use App\Models\StatementLine;
use App\Services\Reconciler;
use App\Support\Period;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * MoMo / bank statement reconciliation. Files are parsed in the browser; only the
 * normalised lines are sent here, so the original statement never leaves the device.
 */
class StatementController extends Controller
{
    public function __construct(private Reconciler $reconciler) {}

    public function index(Request $request): JsonResponse
    {
        $statements = $request->user()->statements()->with('account')
            ->withCount([
                'lines',
                'lines as matched_count' => fn ($q) => $q->where('status', 'matched'),
                'lines as unmatched_count' => fn ($q) => $q->where('status', 'unmatched'),
            ])
            ->orderByDesc('period')->orderBy('account_id')->get();

        return response()->json(['data' => $statements->map(fn (Statement $s) => [
            'id' => $s->id,
            'account' => ['id' => $s->account->id, 'name' => $s->account->name],
            'period' => $s->period,
            'source_name' => $s->source_name,
            'line_count' => $s->lines_count,
            'matched' => $s->matched_count,
            'unmatched' => $s->unmatched_count,
            'imported_at' => $s->updated_at->toIso8601ZuluString(),
        ])]);
    }

    /** Import (or re-import, replacing) a statement for one account and month, then match it. */
    public function store(Request $request): JsonResponse
    {
        $uid = $request->user()->id;
        $data = $request->validate([
            'account_id' => ['required', 'integer', Rule::exists('accounts', 'id')->where('user_id', $uid)],
            'period' => ['required', 'date_format:Y-m'],
            'source_name' => ['nullable', 'string', 'max:255'],
            'opening_balance' => ['nullable', 'integer'],
            'closing_balance' => ['nullable', 'integer'],
            'lines' => ['required', 'array', 'min:1', 'max:5000'],
            'lines.*.occurred_at' => ['required', 'date'],
            'lines.*.amount' => ['required', 'integer', 'not_in:0', 'between:-10000000000000,10000000000000'],
            'lines.*.description' => ['nullable', 'string', 'max:255'],
            'lines.*.reference' => ['nullable', 'string', 'max:100'],
            'lines.*.balance' => ['nullable', 'integer'],
        ], ['lines.*.amount.not_in' => 'Statement lines need a non-zero amount.']);

        $statement = DB::transaction(function () use ($request, $data) {
            $statement = $request->user()->statements()->updateOrCreate(
                ['account_id' => $data['account_id'], 'period' => $data['period']],
                [
                    'source_name' => $data['source_name'] ?? null,
                    'opening_balance' => $data['opening_balance'] ?? null,
                    'closing_balance' => $data['closing_balance'] ?? null,
                ],
            );
            $statement->lines()->delete();
            $now = now();
            foreach (array_chunk($data['lines'], 500) as $chunk) {
                StatementLine::insert(array_map(fn ($l) => [
                    'statement_id' => $statement->id,
                    'occurred_at' => CarbonImmutable::parse($l['occurred_at'])->utc(),
                    'amount' => $l['amount'],
                    'description' => $l['description'] ?? null,
                    'reference' => $l['reference'] ?? null,
                    'balance' => $l['balance'] ?? null,
                    'status' => 'unmatched',
                    'created_at' => $now,
                    'updated_at' => $now,
                ], $chunk));
            }
            $statement->touch();

            return $statement;
        });

        $this->reconciler->run($statement);

        return $this->show($request, $statement->fresh(), 201);
    }

    public function show(Request $request, Statement $statement, int $status = 200): JsonResponse
    {
        $this->authorizeOwner($request, $statement);
        $tz = Period::timezone($request->query('tz'), $request->user()->timezone);
        $statement->load(['account', 'lines' => fn ($q) => $q->orderBy('occurred_at')->orderBy('id'), 'lines.transaction.category', 'lines.transaction.account', 'lines.transaction.toAccount', 'lines.transaction.business']);

        return response()->json([
            'id' => $statement->id,
            'account' => ['id' => $statement->account->id, 'name' => $statement->account->name, 'account_type' => $statement->account->account_type],
            'period' => $statement->period,
            'source_name' => $statement->source_name,
            'summary' => $this->reconciler->summary($statement, $tz),
            'lines' => $statement->lines->map(fn (StatementLine $l) => [
                'id' => $l->id,
                'occurred_at' => $l->occurred_at->toIso8601ZuluString(),
                'amount' => $l->amount,
                'description' => $l->description,
                'reference' => $l->reference,
                'balance' => $l->balance,
                'status' => $l->status,
                'transaction' => $l->transaction?->toApi(),
            ]),
            'app_only' => $this->reconciler->appOnly($statement, $tz)->map->toApi(),
        ], $status);
    }

    public function rematch(Request $request, Statement $statement): JsonResponse
    {
        $this->authorizeOwner($request, $statement);
        $this->reconciler->run($statement);

        return $this->show($request, $statement->fresh());
    }

    /** ignore | unignore | unmatch | match (with transaction_id) */
    public function updateLine(Request $request, Statement $statement, StatementLine $line): JsonResponse
    {
        $this->authorizeOwner($request, $statement);
        abort_unless($line->statement_id === $statement->id, 404);
        $data = $request->validate([
            'action' => ['required', Rule::in(['ignore', 'unignore', 'unmatch', 'match'])],
            'transaction_id' => ['required_if:action,match', 'integer'],
        ]);

        match ($data['action']) {
            'ignore' => $line->update(['status' => 'ignored', 'transaction_id' => null]),
            'unignore', 'unmatch' => $line->update(['status' => 'unmatched', 'transaction_id' => null]),
            'match' => $this->manualMatch($request, $statement, $line, (int) $data['transaction_id']),
        };

        return $this->show($request, $statement->fresh());
    }

    /** Record a statement line that's missing from the app as a new transaction. */
    public function recordLine(Request $request, Statement $statement, StatementLine $line): JsonResponse
    {
        $this->authorizeOwner($request, $statement);
        abort_unless($line->statement_id === $statement->id, 404);
        abort_if($line->status === 'matched', 422, 'This line is already matched.');

        $uid = $request->user()->id;
        $type = $line->amount > 0 ? 'income' : 'expense';
        $data = $request->validate([
            'category_id' => ['required', 'integer', Rule::exists('categories', 'id')->where('user_id', $uid)->where('transaction_type', $type)],
            'scope' => ['required', Rule::in(['personal', 'business'])],
            'business_id' => ['nullable', 'integer', Rule::exists('businesses', 'id')->where('user_id', $uid)],
            'description' => ['nullable', 'string', 'max:255'],
        ], ['category_id.exists' => 'Pick a category that matches the transaction type.']);

        DB::transaction(function () use ($request, $statement, $line, $data, $type) {
            $tx = $request->user()->transactions()->create([
                'type' => $type,
                'amount' => abs($line->amount),
                'scope' => $data['scope'],
                'business_id' => $data['scope'] === 'business' ? ($data['business_id'] ?? null) : null,
                'category_id' => $data['category_id'],
                'account_id' => $statement->account_id,
                'description' => ($data['description'] ?? null) ?: $line->description,
                'occurred_at' => $line->occurred_at,
            ]);
            $line->update(['status' => 'matched', 'transaction_id' => $tx->id]);
        });

        return $this->show($request, $statement->fresh());
    }

    public function destroy(Request $request, Statement $statement): JsonResponse
    {
        $this->authorizeOwner($request, $statement);
        $statement->delete();

        return response()->json(null, 204);
    }

    private function manualMatch(Request $request, Statement $statement, StatementLine $line, int $txId): void
    {
        $tx = $request->user()->transactions()->find($txId);
        abort_unless($tx, 422, 'Transaction not found.');
        abort_if(Reconciler::signedFor($tx, $statement->account_id) === 0, 422, 'That transaction is not on this account.');
        // Free it from any other line first so a transaction matches only one line.
        StatementLine::whereIn('statement_id', $request->user()->statements()->select('id'))
            ->where('transaction_id', $tx->id)->update(['status' => 'unmatched', 'transaction_id' => null]);
        $line->update(['status' => 'matched', 'transaction_id' => $tx->id]);
    }
}
