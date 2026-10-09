<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Gives a new user sensible starting categories, accounts and businesses.
 * Everything created here is the user's own and can be renamed or archived.
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

    public const BUSINESSES = ['MachineWura', 'MediaWura', 'SneakersInn', 'Paylead', 'Other'];

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
            foreach (self::BUSINESSES as $name) {
                $user->businesses()->create(['name' => $name]);
            }
            foreach (self::ACCOUNTS as [$name, $type]) {
                $user->accounts()->create(['name' => $name, 'account_type' => $type, 'opening_balance' => 0]);
            }
        });
    }
}
