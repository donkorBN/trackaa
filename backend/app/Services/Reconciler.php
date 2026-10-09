<?php

namespace App\Services;

use App\Models\Statement;
use App\Models\StatementLine;
use App\Models\Transaction;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Matches statement lines to recorded transactions on the same account:
 * same signed amount, within a few days of each other, each transaction
 * used at most once across all statements.
 */
class Reconciler
{
    public const DAY_WINDOW = 3;

    /** Signed effect of a transaction on one account: + money in, - money out. */
    public static function signedFor(Transaction $t, int $accountId): int
    {
        return match (true) {
            $t->type === 'income' && $t->account_id === $accountId => $t->amount,
            $t->type === 'expense' && $t->account_id === $accountId => -$t->amount,
            $t->type === 'transfer' && $t->account_id === $accountId => -$t->amount,
            $t->type === 'transfer' && $t->to_account_id === $accountId => $t->amount,
            default => 0,
        };
    }

    public function run(Statement $statement): void
    {
        $user = User::findOrFail($statement->user_id);
        $lines = $statement->lines()->orderBy('occurred_at')->get();

        // A match whose transaction was deleted is no longer a match.
        $lines->where('status', 'matched')->whereNull('transaction_id')->each(function (StatementLine $l) {
            $l->update(['status' => 'unmatched']);
        });

        $open = $lines->where('status', 'unmatched');
        if ($open->isEmpty()) {
            return;
        }

        $accountId = $statement->account_id;
        $from = $open->min('occurred_at')->copy()->subDays(self::DAY_WINDOW);
        $to = $open->max('occurred_at')->copy()->addDays(self::DAY_WINDOW);

        $used = StatementLine::query()
            ->whereIn('statement_id', $user->statements()->select('id'))
            ->where('status', 'matched')->whereNotNull('transaction_id')
            ->pluck('transaction_id')->flip();

        /** @var Collection<int, Transaction> $candidates */
        $candidates = $user->transactions()
            ->where(fn ($q) => $q->where('account_id', $accountId)->orWhere('to_account_id', $accountId))
            ->whereBetween('occurred_at', [$from, $to])
            ->get()
            ->reject(fn (Transaction $t) => $used->has($t->id))
            ->keyBy('id');

        foreach ($open as $line) {
            $best = null;
            $bestGap = PHP_INT_MAX;
            foreach ($candidates as $t) {
                if (self::signedFor($t, $accountId) !== $line->amount) {
                    continue;
                }
                $gap = abs($t->occurred_at->diffInSeconds($line->occurred_at));
                if ($gap <= self::DAY_WINDOW * 86400 && $gap < $bestGap) {
                    $best = $t;
                    $bestGap = $gap;
                }
            }
            if ($best) {
                $line->update(['status' => 'matched', 'transaction_id' => $best->id]);
                $candidates->forget($best->id);
            }
        }
    }

    /** Totals and balance comparison for the statement's account and month. */
    public function summary(Statement $statement, string $tz): array
    {
        $user = User::findOrFail($statement->user_id);
        $account = $statement->account;
        $start = CarbonImmutable::createFromFormat('!Y-m', $statement->period, $tz)->startOfMonth();
        $end = $start->addMonth();
        $lines = $statement->lines;

        $txs = $user->transactions()
            ->where(fn ($q) => $q->where('account_id', $account->id)->orWhere('to_account_id', $account->id))
            ->where('occurred_at', '<', $end->utc())
            ->get(['id', 'type', 'amount', 'account_id', 'to_account_id', 'occurred_at']);

        $appIn = $appOut = 0;
        $recordedClosing = $account->opening_balance;
        foreach ($txs as $t) {
            $s = self::signedFor($t, $account->id);
            $recordedClosing += $s;
            if ($t->occurred_at->gte($start)) {
                $s > 0 ? $appIn += $s : $appOut -= $s;
            }
        }

        $statementClosing = $statement->closing_balance
            ?? $lines->sortBy([['occurred_at', 'asc'], ['id', 'asc']])->whereNotNull('balance')->last()?->balance;

        return [
            'statement_in' => (int) $lines->where('amount', '>', 0)->sum('amount'),
            'statement_out' => (int) -$lines->where('amount', '<', 0)->sum('amount'),
            'app_in' => $appIn,
            'app_out' => $appOut,
            'statement_closing' => $statementClosing,
            'recorded_closing' => $recordedClosing,
            'difference' => $statementClosing === null ? null : $statementClosing - $recordedClosing,
            'counts' => [
                'total' => $lines->count(),
                'matched' => $lines->where('status', 'matched')->count(),
                'unmatched' => $lines->where('status', 'unmatched')->count(),
                'ignored' => $lines->where('status', 'ignored')->count(),
            ],
        ];
    }

    /** Transactions recorded on this account in the month that no statement line matched. */
    public function appOnly(Statement $statement, string $tz): Collection
    {
        $start = CarbonImmutable::createFromFormat('!Y-m', $statement->period, $tz)->startOfMonth();
        $matched = $statement->lines->where('status', 'matched')->pluck('transaction_id')->filter()->flip();
        $accountId = $statement->account_id;

        return Transaction::query()
            ->where('user_id', $statement->user_id)
            ->where(fn ($q) => $q->where('account_id', $accountId)->orWhere('to_account_id', $accountId))
            ->where('occurred_at', '>=', $start->utc())->where('occurred_at', '<', $start->addMonth()->utc())
            ->with(['business', 'category', 'account', 'toAccount'])
            ->orderBy('occurred_at')
            ->get()
            ->reject(fn ($t) => $matched->has($t->id))
            ->values();
    }
}
