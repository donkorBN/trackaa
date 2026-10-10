<?php

namespace Database\Seeders;

use App\Models\User;
use App\Services\DefaultSetup;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

/**
 * DEVELOPMENT ONLY. Creates a separate demo account (demo@trackaa.test / password)
 * with sample transactions, every one labelled "[Sample]". Never run in production.
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->isProduction()) {
            $this->command->error('DemoSeeder refuses to run in production.');

            return;
        }

        User::where('email', 'demo@trackaa.test')->delete();
        $user = User::create(['name' => 'Demo (sample data)', 'email' => 'demo@trackaa.test', 'password' => 'password']);
        app(DefaultSetup::class)->provision($user);

        $cat = fn ($n) => $user->categories()->where('name', $n)->value('id');
        $acc = fn ($n) => $user->accounts()->where('name', $n)->value('id');
        $biz = fn ($n) => $user->businesses()->firstOrCreate(['name' => $n])->id;
        $now = CarbonImmutable::now();

        $rows = [
            ['income', 450000, 'personal', null, 'Salary', 'Bank', 'Monthly salary', 6],
            ['income', 120000, 'business', 'SneakersInn', 'Business Sales', 'Mobile Money', '2 pairs sold', 1],
            ['expense', 60000, 'business', 'SneakersInn', 'Inventory / Stock', 'Mobile Money', 'Restock', 2],
            ['expense', 15000, 'business', 'MediaWura', 'Marketing / Advertising', 'Mobile Money', 'Instagram ads', 3],
            ['expense', 3500, 'personal', null, 'Food', 'Cash', 'Waakye', 0],
            ['expense', 1200, 'personal', null, 'Transport', 'Cash', 'Trotro', 0],
            ['expense', 250, 'personal', null, 'Bank / MoMo Fees', 'Mobile Money', 'MoMo charge', 1],
        ];
        foreach ($rows as [$type, $amount, $scope, $b, $c, $a, $note, $daysAgo]) {
            $user->transactions()->create([
                'type' => $type, 'amount' => $amount, 'scope' => $scope,
                'business_id' => $b ? $biz($b) : null, 'category_id' => $cat($c), 'account_id' => $acc($a),
                'description' => "[Sample] {$note}", 'occurred_at' => $now->subDays($daysAgo)->utc(),
            ]);
        }
        $user->transactions()->create([
            'type' => 'transfer', 'amount' => 50000, 'scope' => 'personal',
            'account_id' => $acc('Bank'), 'to_account_id' => $acc('Mobile Money'),
            'description' => '[Sample] Top up MoMo', 'occurred_at' => $now->subDays(2)->utc(),
        ]);

        $this->command->info('Demo user: demo@trackaa.test / password');
    }
}
