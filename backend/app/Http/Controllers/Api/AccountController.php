<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Services\Ledger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AccountController extends Controller
{
    public function index(Request $request, Ledger $ledger): JsonResponse
    {
        $user = $request->user();
        $all = $user->accounts()->orderBy('id')->get();
        $balances = $ledger->balances($user, $all);
        $shown = $request->boolean('include_archived') ? $all : $all->filter(fn ($a) => ! $a->isArchived());

        return response()->json([
            'data' => $shown->values()->map(fn (Account $a) => $this->present($a, $balances[$a->id])),
            // Total across active accounts only.
            'total_balance' => $all->filter(fn ($a) => ! $a->isArchived())->sum(fn ($a) => $balances[$a->id]),
        ]);
    }

    public function store(Request $request, Ledger $ledger): JsonResponse
    {
        $account = $request->user()->accounts()->create($this->validated($request, true));

        return response()->json($this->present($account, $account->opening_balance), 201);
    }

    public function update(Request $request, Account $account, Ledger $ledger): JsonResponse
    {
        $this->authorizeOwner($request, $account);
        $account->fill($this->validated($request, false));
        if ($request->has('archived')) {
            $account->setArchived($request->boolean('archived'));
        }
        $account->save();
        $balance = $ledger->balances($request->user(), collect([$account]))[$account->id];

        return response()->json($this->present($account, $balance));
    }

    private function validated(Request $request, bool $creating): array
    {
        $req = $creating ? 'required' : 'sometimes';

        return $request->validate([
            'name' => [$req, 'string', 'max:80'],
            'account_type' => [$req, Rule::in(Account::TYPES)],
            'opening_balance' => ['sometimes', 'integer', 'between:-10000000000000,10000000000000'],
            'archived' => ['sometimes', 'boolean'],
        ]);
    }

    /** Only unused items can be deleted; anything with history is archived instead, so totals never change. */
    public function destroy(Request $request, Account $account): JsonResponse
    {
        $this->authorizeOwner($request, $account);
        abort_if(
            $request->user()->transactions()->where(fn ($q) => $q->where('account_id', $account->id)->orWhere('to_account_id', $account->id))->exists()
            || $account->statements()->exists(),
            422,
            'This is used by existing transactions. Archive it instead.',
        );
        $account->delete();

        return response()->json(null, 204);
    }

    private function present(Account $a, int $balance): array
    {
        return [
            'id' => $a->id,
            'name' => $a->name,
            'account_type' => $a->account_type,
            'opening_balance' => $a->opening_balance,
            'balance' => $balance,
            'archived' => $a->isArchived(),
        ];
    }
}
