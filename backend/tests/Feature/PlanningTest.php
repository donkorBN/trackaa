<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\DefaultSetup;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PlanningTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        // Wednesday 15 Oct 2025, 14:00 Accra (UTC+0). October has 31 days.
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2025-10-15 14:00:00', 'UTC'));
        $this->travelTo(CarbonImmutable::parse('2025-10-15 14:00:00', 'UTC'));
        $this->user = $this->makeUser();
        Sanctum::actingAs($this->user);
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    private function makeUser(): User
    {
        $u = User::factory()->create(['timezone' => 'Africa/Accra']);
        app(DefaultSetup::class)->provision($u);

        return $u;
    }

    private function cat(string $n, ?User $u = null): int
    {
        return ($u ?? $this->user)->categories()->where('name', $n)->value('id');
    }

    private function acct(string $n, ?User $u = null): int
    {
        return ($u ?? $this->user)->accounts()->where('name', $n)->value('id');
    }

    private function tx(array $o): array
    {
        return $this->postJson('/api/transactions', array_merge([
            'type' => 'expense', 'amount' => 1000, 'scope' => 'personal',
            'category_id' => $this->cat('Food'), 'account_id' => $this->acct('Mobile Money'),
        ], $o))->assertCreated()->json();
    }

    public function test_budgets_track_spending_with_daily_and_weekly_breakdown(): void
    {
        $this->postJson('/api/budgets', ['amount' => 310000])->assertCreated(); // GH₵ 3,100 overall
        $this->postJson('/api/budgets', ['amount' => 62000, 'category_id' => $this->cat('Food')])->assertCreated();
        $this->postJson('/api/budgets', ['amount' => 100, 'category_id' => $this->cat('Salary')])->assertJsonValidationErrors('category_id');

        $this->tx(['amount' => 5000]); // today, Food
        $this->tx(['amount' => 20000, 'category_id' => $this->cat('Transport'), 'occurred_at' => '2025-10-13T09:00:00Z']); // Monday, this week
        $this->tx(['amount' => 30000, 'occurred_at' => '2025-10-02T09:00:00Z']); // earlier this month
        $this->tx(['amount' => 99999, 'occurred_at' => '2025-09-30T09:00:00Z']); // last month: ignored
        $this->tx(['type' => 'income', 'amount' => 500000, 'category_id' => $this->cat('Salary')]); // not spending
        $this->tx(['type' => 'transfer', 'amount' => 70000, 'to_account_id' => $this->acct('Bank')]); // not spending

        $res = $this->getJson('/api/budgets')->assertOk()
            ->assertJsonPath('month', '2025-10')->assertJsonPath('days_in_month', 31)
            ->assertJsonPath('days_left', 17);

        $overall = $res->json('data.0');
        $this->assertNull($overall['category']);
        $this->assertSame(55000, $overall['spent']);
        $this->assertSame(255000, $overall['remaining']);
        $this->assertSame(10000, $overall['daily']);          // 3,100 / 31
        $this->assertSame(70000, $overall['weekly']);         // 3,100 * 7 / 31
        $this->assertSame(150000, $overall['expected_by_now']); // 15 of 31 days
        $this->assertSame(15000, $overall['daily_allowance']); // 2,550 left over 17 days
        $this->assertSame(5000, $overall['spent_today']);
        $this->assertSame(25000, $overall['spent_this_week']);

        $food = $res->json('data.1');
        $this->assertSame('Food', $food['category']['name']);
        $this->assertSame(35000, $food['spent']);

        // Same category+scope again updates instead of duplicating.
        $this->postJson('/api/budgets', ['amount' => 1000, 'category_id' => $this->cat('Food')]);
        $this->assertCount(2, $this->getJson('/api/budgets')->json('data'));
    }

    public function test_budget_scope_filters_spending(): void
    {
        $this->postJson('/api/budgets', ['amount' => 100000, 'scope' => 'personal']);
        $this->tx(['amount' => 4000]);
        $this->tx(['amount' => 9000, 'scope' => 'business', 'category_id' => $this->cat('Inventory / Stock')]);
        $this->assertSame(4000, $this->getJson('/api/budgets')->json('data.0.spent'));
    }

    public function test_goals_progress_and_projection(): void
    {
        $goal = $this->postJson('/api/goals', ['name' => 'Emergency fund', 'target_amount' => 1000000, 'target_date' => '2026-04-15'])
            ->assertCreated()->json();
        $this->assertSame(0, $goal['saved']);

        $this->postJson("/api/goals/{$goal['id']}/contributions", ['amount' => 100000, 'occurred_on' => '2025-09-16'])->assertOk();
        $res = $this->postJson("/api/goals/{$goal['id']}/contributions", ['amount' => 200000, 'note' => 'Bonus'])->assertOk();
        $res->assertJsonPath('saved', 300000)->assertJsonPath('percent', 30)->assertJsonPath('remaining', 700000)
            ->assertJsonPath('contributions.0.note', 'Bonus')->assertJsonPath('contributions.0.running_total', 300000);

        // 182 days to the target date -> 7,000 remaining needs ~269.24/week.
        $this->assertSame(26924, $res->json('weekly_needed'));
        // Pace: 3,000 over 30 days -> 7,000 more needs 70 days.
        $this->assertSame('2025-12-24', $res->json('projected_date'));
        $this->assertTrue($res->json('on_track'));

        $cid = $res->json('contributions.0.id');
        $this->deleteJson("/api/goals/{$goal['id']}/contributions/{$cid}")->assertOk()->assertJsonPath('saved', 100000);

        $other = $this->makeUser();
        Sanctum::actingAs($other);
        $this->getJson("/api/goals/{$goal['id']}")->assertNotFound();
        $this->postJson("/api/goals/{$goal['id']}/contributions", ['amount' => 5])->assertNotFound();
    }

    public function test_insights_trends_and_patterns(): void
    {
        $this->tx(['type' => 'income', 'amount' => 400000, 'category_id' => $this->cat('Salary'), 'occurred_at' => '2025-09-25T10:00:00Z']);
        $this->tx(['amount' => 6000, 'occurred_at' => '2025-09-10T10:00:00Z']); // food, last month before cutoff
        $this->tx(['amount' => 3000, 'occurred_at' => '2025-09-20T10:00:00Z']); // food, last month after cutoff
        $this->tx(['amount' => 9000, 'occurred_at' => '2025-10-11T10:00:00Z']); // Saturday
        $this->tx(['amount' => 1000, 'occurred_at' => '2025-10-15T08:00:00Z']); // Wednesday
        $this->tx(['type' => 'transfer', 'amount' => 50000, 'to_account_id' => $this->acct('Bank')]);

        $res = $this->getJson('/api/insights?months=3')->assertOk();
        $this->assertSame(['2025-08', '2025-09', '2025-10'], array_column($res->json('months'), 'month'));
        $this->assertSame(['month' => '2025-09', 'income' => 400000, 'expense' => 9000, 'net' => 391000], $res->json('months.1'));
        $this->assertSame(10000, $res->json('months.2.expense'));
        $this->assertCount(31, $res->json('daily'));
        $this->assertSame(9000, $res->json('daily.10.expense'));

        $weekdays = collect($res->json('weekdays'))->keyBy('label');
        $this->assertSame(12000, $weekdays['Sat']['total']); // 20 Sep + 11 Oct
        $this->assertSame(7000, $weekdays['Wed']['total']);  // 10 Sep + 15 Oct
        $this->assertSame(intdiv(12000, $weekdays['Sat']['days']), $weekdays['Sat']['average']);
        $this->assertSame(0, $weekdays['Mon']['total']);

        $food = collect($res->json('categories'))->firstWhere('name', 'Food');
        $this->assertSame(10000, $food['this_month']);
        $this->assertSame(6000, $food['last_month_to_date']);
        $this->assertSame(9000, $food['last_month']);
        $this->assertSame(4000, $food['change']);

        $this->assertSame(666, $res->json('stats.average_daily_spend')); // 100 / 15 days
        $this->assertSame(9000, $res->json('top_expenses.0.amount'));
    }

    public function test_statement_import_matches_and_reconciles(): void
    {
        $momo = $this->acct('Mobile Money');
        $this->patchJson("/api/accounts/{$momo}", ['opening_balance' => 50000]);
        $food = $this->tx(['amount' => 2500, 'occurred_at' => '2025-10-03T12:00:00Z']);
        $sale = $this->tx(['type' => 'income', 'amount' => 120000, 'category_id' => $this->cat('Business Sales'), 'occurred_at' => '2025-10-05T09:00:00Z']);
        $xfer = $this->tx(['type' => 'transfer', 'amount' => 30000, 'to_account_id' => $this->acct('Bank'), 'occurred_at' => '2025-10-07T09:00:00Z']);
        $onlyApp = $this->tx(['amount' => 777, 'occurred_at' => '2025-10-08T09:00:00Z']);
        $this->tx(['amount' => 2500, 'account_id' => $this->acct('Cash'), 'occurred_at' => '2025-10-03T12:00:00Z']); // other account: never matches

        $res = $this->postJson('/api/statements', [
            'account_id' => $momo, 'period' => '2025-10', 'source_name' => 'MTN Oct.pdf',
            'lines' => [
                ['occurred_at' => '2025-10-04T18:00:00Z', 'amount' => -2500, 'description' => 'Payment to Chop Bar', 'balance' => 47500],
                ['occurred_at' => '2025-10-05T09:01:00Z', 'amount' => 120000, 'description' => 'Cash in', 'balance' => 167500],
                ['occurred_at' => '2025-10-07T09:00:00Z', 'amount' => -30000, 'description' => 'Transfer to bank', 'balance' => 137500],
                ['occurred_at' => '2025-10-07T09:00:00Z', 'amount' => -150, 'description' => 'Transfer fee', 'balance' => 137350],
                ['occurred_at' => '2025-10-20T09:00:00Z', 'amount' => -5000, 'description' => 'Airtime', 'balance' => 132350],
            ],
        ])->assertCreated();

        $lines = collect($res->json('lines'));
        $this->assertSame(['matched', 'matched', 'matched', 'unmatched', 'unmatched'], $lines->pluck('status')->all());
        $this->assertSame($food['id'], $lines[0]['transaction']['id']);
        $this->assertSame($xfer['id'], $lines[2]['transaction']['id']);
        $this->assertSame([$onlyApp['id']], collect($res->json('app_only'))->pluck('id')->all());

        $sum = $res->json('summary');
        $this->assertSame(120000, $sum['statement_in']);
        $this->assertSame(37650, $sum['statement_out']);
        $this->assertSame(132350, $sum['statement_closing']);
        $this->assertSame(50000 - 2500 + 120000 - 30000 - 777, $sum['recorded_closing']);
        $this->assertSame(132350 - 136723, $sum['difference']);

        // Record the missing fee from the statement.
        $sid = $res->json('id');
        $feeLine = $lines[3]['id'];
        $after = $this->postJson("/api/statements/{$sid}/lines/{$feeLine}/record", ['category_id' => $this->cat('Bank / MoMo Fees'), 'scope' => 'personal'])->assertOk();
        $this->assertSame('matched', collect($after->json('lines'))->firstWhere('id', $feeLine)['status']);
        $this->assertDatabaseHas('transactions', ['description' => 'Transfer fee', 'amount' => 150, 'type' => 'expense']);

        // Ignore airtime, then manually match it to the app-only expense; unmatch works.
        $airtime = $lines[4]['id'];
        $this->patchJson("/api/statements/{$sid}/lines/{$airtime}", ['action' => 'ignore'])->assertOk()
            ->assertJsonPath('summary.counts.ignored', 1);
        $this->patchJson("/api/statements/{$sid}/lines/{$airtime}", ['action' => 'match', 'transaction_id' => $onlyApp['id']])->assertOk()
            ->assertJsonPath('app_only', []);

        // Deleting a matched transaction frees its line on rematch.
        $this->deleteJson("/api/transactions/{$food['id']}")->assertNoContent();
        $this->postJson("/api/statements/{$sid}/rematch")->assertOk()->assertJsonPath('summary.counts.unmatched', 1);

        // Re-importing the same account+month replaces the lines.
        $this->postJson('/api/statements', ['account_id' => $momo, 'period' => '2025-10', 'lines' => [
            ['occurred_at' => '2025-10-05T09:00:00Z', 'amount' => 120000],
        ]])->assertCreated()->assertJsonPath('summary.counts.total', 1);
        $this->assertCount(1, $this->getJson('/api/statements')->json('data'));
    }

    public function test_statements_are_private(): void
    {
        $sid = $this->postJson('/api/statements', ['account_id' => $this->acct('Cash'), 'period' => '2025-10', 'lines' => [
            ['occurred_at' => '2025-10-05T09:00:00Z', 'amount' => -100],
        ]])->assertCreated()->json('id');

        $other = $this->makeUser();
        Sanctum::actingAs($other);
        $this->getJson("/api/statements/{$sid}")->assertNotFound();
        $this->deleteJson("/api/statements/{$sid}")->assertNotFound();
        $this->getJson('/api/statements')->assertJsonPath('data', []);
        // Can't import onto someone else's account.
        $this->postJson('/api/statements', ['account_id' => $this->acct('Cash'), 'period' => '2025-10', 'lines' => [
            ['occurred_at' => '2025-10-05T09:00:00Z', 'amount' => -100],
        ]])->assertJsonValidationErrors('account_id');
    }
}
