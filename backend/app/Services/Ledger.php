<?php

namespace App\Services;

use App\Models\Account;
use App\Models\User;
use App\Support\Period;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/**
 * All money arithmetic happens here, in SQL integer sums of pesewas.
 * Transfers move money between the user's own accounts and are never
 * counted as income or expense.
 */
class Ledger
{
    /** Apply the shared filter parameters (scope, business, category, account, type, search). */
    public function filtered(User $user, Request $request): Builder
    {
        $q = $user->transactions()->getQuery();

        $scope = $request->query('scope');
        if (in_array($scope, ['personal', 'business'], true)) {
            $q->where('scope', $scope);
        }
        if ($request->filled('business_id')) {
            $q->where('business_id', (int) $request->query('business_id'));
        }
        if ($request->filled('category_id')) {
            $q->where('category_id', (int) $request->query('category_id'));
        }
        if ($request->filled('account_id')) {
            $id = (int) $request->query('account_id');
            $q->where(fn ($w) => $w->where('account_id', $id)->orWhere('to_account_id', $id));
        }
        if (in_array($request->query('type'), ['income', 'expense', 'transfer'], true)) {
            $q->where('type', $request->query('type'));
        }
        if ($request->filled('q')) {
            $term = '%'.trim((string) $request->query('q')).'%';
            $q->where(function ($w) use ($term) {
                $w->whereLike('description', $term)
                    ->orWhereHas('business', fn ($b) => $b->whereLike('name', $term))
                    ->orWhereHas('category', fn ($c) => $c->whereLike('name', $term));
            });
        }

        return $q;
    }

    public function within(Builder $q, Period $period): Builder
    {
        return $q->where('occurred_at', '>=', $period->start)->where('occurred_at', '<', $period->end);
    }

    /** @return array{income:int, expense:int, net:int} */
    public function totals(Builder $q): array
    {
        $row = (clone $q)
            ->selectRaw("COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income")
            ->selectRaw("COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense")
            ->reorder()
            ->first();

        $income = (int) $row->income;
        $expense = (int) $row->expense;

        return ['income' => $income, 'expense' => $expense, 'net' => $income - $expense];
    }

    public function expenseByCategory(Builder $q): Collection
    {
        return (clone $q)->where('transactions.type', 'expense')
            ->join('categories', 'categories.id', '=', 'transactions.category_id')
            ->groupBy('categories.id', 'categories.name')
            ->selectRaw('categories.id AS id, categories.name AS name, SUM(transactions.amount) AS total')
            ->reorder()
            ->orderByDesc('total')
            ->get()
            ->map(fn ($r) => ['id' => (int) $r->id, 'name' => $r->name, 'total' => (int) $r->total]);
    }

    public function byBusiness(Builder $q): Collection
    {
        return (clone $q)->where('transactions.scope', 'business')
            ->whereIn('transactions.type', ['income', 'expense'])
            ->leftJoin('businesses', 'businesses.id', '=', 'transactions.business_id')
            ->groupBy('businesses.id', 'businesses.name')
            ->selectRaw('businesses.id AS id, businesses.name AS name')
            ->selectRaw("COALESCE(SUM(CASE WHEN transactions.type = 'income' THEN transactions.amount ELSE 0 END), 0) AS income")
            ->selectRaw("COALESCE(SUM(CASE WHEN transactions.type = 'expense' THEN transactions.amount ELSE 0 END), 0) AS expense")
            ->reorder()
            ->get()
            ->map(fn ($r) => [
                'id' => $r->id === null ? null : (int) $r->id,
                'name' => $r->name ?? 'No business selected',
                'income' => (int) $r->income,
                'expense' => (int) $r->expense,
                'net' => (int) $r->income - (int) $r->expense,
            ])
            ->sortByDesc(fn ($b) => $b['income'] + $b['expense'])
            ->values();
    }

    /**
     * Recorded balance per account: opening balance plus everything recorded.
     * This is NOT the real MoMo/bank balance — only what the user has entered.
     *
     * @param  Collection<int, Account>  $accounts
     * @return array<int, int> account id => pesewas
     */
    public function balances(User $user, Collection $accounts): array
    {
        $tx = $user->transactions()->getQuery();

        $out = (clone $tx)->groupBy('account_id')
            ->selectRaw("account_id AS id, SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS delta")
            ->pluck('delta', 'id');
        $in = (clone $tx)->where('type', 'transfer')->groupBy('to_account_id')
            ->selectRaw('to_account_id AS id, SUM(amount) AS delta')
            ->pluck('delta', 'id');

        $result = [];
        foreach ($accounts as $a) {
            $result[$a->id] = $a->opening_balance + (int) ($out[$a->id] ?? 0) + (int) ($in[$a->id] ?? 0);
        }

        return $result;
    }
}
