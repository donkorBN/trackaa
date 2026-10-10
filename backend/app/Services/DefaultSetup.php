<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Gives a new user sensible starting categories and accounts. Businesses are not
 * pre-filled: people add their own during onboarding. Everything here can be
 * renamed, archived or (if unused) deleted.
 */
class DefaultSetup
{
    public const INCOME_CATEGORIES = [
        'Salary', 'Business Sales', 'Freelance / Services', 'Commission',
        'Investment Income', 'Refund', 'Other Income',
    ];

    public const EXPENSE_CATEGORIES = [
        'Food', 'Transport', 'Rent / Housing', 'Utilities', 'Shopping', 'Health',
        'Education', 'Entertainment', 'Subscriptions', 'Marketing / Advertising',
        'Inventory / Stock', 'Business Operations', 'Staff / Contractors', 'Delivery',
        'Bank / MoMo Fees', 'Debt Repayment', 'Other Expense',
    ];

    public const ACCOUNTS = [
        ['Mobile Money', 'mobile_money'],
        ['Cash', 'cash'],
        ['Bank', 'bank'],
    ];

    public function provision(User $user): void
    {
        DB::transaction(function () use ($user) {
            foreach (self::INCOME_CATEGORIES as $name) {
                $user->categories()->create(['name' => $name, 'transaction_type' => 'income']);
            }
            foreach (self::EXPENSE_CATEGORIES as $name) {
                $user->categories()->create(['name' => $name, 'transaction_type' => 'expense']);
            }
            foreach (self::ACCOUNTS as [$name, $type]) {
                $user->accounts()->create(['name' => $name, 'account_type' => $type, 'opening_balance' => 0]);
            }
        });
    }
}
