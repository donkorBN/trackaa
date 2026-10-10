<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\DefaultSetup;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FinanceTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        // Wednesday 15 Oct 2025, 14:00 in Accra (UTC+0).
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2025-10-15 14:00:00', 'UTC'));
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
        $user = User::factory()->create(['timezone' => 'Africa/Accra']);
        app(DefaultSetup::class)->provision($user);

        return $user;
    }

    private function cat(string $name, ?User $u = null): int
    {
        return ($u ?? $this->user)->categories()->where('name', $name)->value('id');
    }

    private function acct(string $name, ?User $u = null): int
    {
        return ($u ?? $this->user)->accounts()->where('name', $name)->value('id');
    }

    private function biz(string $name): int
    {
        return $this->user->businesses()->firstOrCreate(['name' => $name])->id;
    }

    private function add(array $overrides = []): array
    {
        return $this->postJson('/api/transactions', array_merge([
            'type' => 'expense',
            'amount' => 2500,
            'scope' => 'personal',
            'category_id' => $this->cat('Food'),
            'account_id' => $this->acct('Mobile Money'),
        ], $overrides))->assertCreated()->json();
    }

    public function test_registration_provisions_defaults_and_returns_token(): void
    {
        $res = $this->postJson('/api/auth/register', [
            'name' => 'Ama', 'email' => 'ama@example.com',
            'password' => 'secret-pass', 'password_confirmation' => 'secret-pass',
        ])->assertCreated();

        $this->assertNotEmpty($res->json('token'));
        $user = User::where('email', 'ama@example.com')->first();
        $this->assertSame(7, $user->categories()->where('transaction_type', 'income')->count());
        $this->assertSame(17, $user->categories()->where('transaction_type', 'expense')->count());
        $this->assertSame(0, $user->businesses()->count()); // people add their own businesses
        $this->assertSame(3, $user->accounts()->count());
    }

    public function test_create_income_and_expense_and_totals(): void
    {
        $this->add(['type' => 'income', 'amount' => 150000, 'category_id' => $this->cat('Salary')]);
        $this->add(['amount' => 2550]);

        $this->getJson('/api/overview')
            ->assertOk()
            ->assertJsonPath('today', ['income' => 150000, 'expense' => 2550, 'net' => 147450])
            ->assertJsonPath('month', ['income' => 150000, 'expense' => 2550, 'net' => 147450])
            ->assertJsonPath('categories.0.name', 'Food')
            ->assertJsonPath('has_transactions', true);
    }

    public function test_past_dated_transactions_land_in_correct_period(): void
    {
        $this->add(['amount' => 1000, 'occurred_at' => '2025-10-14T20:00:00Z']); // yesterday, this month
        $this->add(['amount' => 3000, 'occurred_at' => '2025-09-30T23:59:00Z']); // last month
        $this->add(['amount' => 500]); // now

        $res = $this->getJson('/api/overview')->assertOk();
        $this->assertSame(500, $res->json('today.expense'));
        $this->assertSame(1500, $res->json('month.expense'));

        $this->getJson('/api/overview?period=week')->assertJsonPath('period.expense', 1500);
        $this->getJson('/api/overview?period=custom&from=2025-09-01&to=2025-09-30')
            ->assertJsonPath('period.expense', 3000)
            ->assertJsonPath('period.from', '2025-09-01')
            ->assertJsonPath('period.to', '2025-09-30');
    }

    public function test_edit_and_delete_update_totals(): void
    {
        $tx = $this->add(['amount' => 1000]);

        $this->patchJson("/api/transactions/{$tx['id']}", ['amount' => 4000, 'description' => 'Lunch'])
            ->assertOk()->assertJsonPath('amount', 4000)->assertJsonPath('description', 'Lunch')
            ->assertJsonPath('category.name', 'Food'); // untouched fields preserved
        $this->getJson('/api/overview')->assertJsonPath('today.expense', 4000);

        // Change it into income: category must match the new type.
        $this->patchJson("/api/transactions/{$tx['id']}", ['type' => 'income'])->assertUnprocessable()
            ->assertJsonValidationErrors('category_id');
        $this->patchJson("/api/transactions/{$tx['id']}", ['type' => 'income', 'category_id' => $this->cat('Refund')])->assertOk();
        $this->getJson('/api/overview')->assertJsonPath('today', ['income' => 4000, 'expense' => 0, 'net' => 4000]);

        $this->deleteJson("/api/transactions/{$tx['id']}")->assertNoContent();
        $this->getJson('/api/overview')->assertJsonPath('today', ['income' => 0, 'expense' => 0, 'net' => 0]);
    }

    public function test_transfers_do_not_count_as_income_or_expense_but_move_balances(): void
    {
        $this->patchJson('/api/accounts/'.$this->acct('Mobile Money'), ['opening_balance' => 100000])->assertOk();
        $this->add(['type' => 'transfer', 'amount' => 40000, 'category_id' => $this->cat('Food'), 'to_account_id' => $this->acct('Bank')]);

        $this->getJson('/api/overview')->assertJsonPath('today', ['income' => 0, 'expense' => 0, 'net' => 0])
            ->assertJsonPath('categories', []);

        $accounts = collect($this->getJson('/api/accounts')->json('data'))->keyBy('name');
        $this->assertSame(60000, $accounts['Mobile Money']['balance']);
        $this->assertSame(40000, $accounts['Bank']['balance']);
        $this->assertSame(100000, $this->getJson('/api/accounts')->json('total_balance'));
    }

    public function test_transfer_needs_two_different_accounts(): void
    {
        $this->postJson('/api/transactions', [
            'type' => 'transfer', 'amount' => 100, 'scope' => 'personal',
            'account_id' => $this->acct('Cash'), 'to_account_id' => $this->acct('Cash'),
        ])->assertUnprocessable()->assertJsonValidationErrors('to_account_id');
    }

    public function test_validation_rejects_zero_amount_and_wrong_category_type(): void
    {
        $base = ['type' => 'expense', 'scope' => 'personal', 'account_id' => $this->acct('Cash')];
        $this->postJson('/api/transactions', $base + ['amount' => 0, 'category_id' => $this->cat('Food')])
            ->assertJsonValidationErrors('amount');
        $this->postJson('/api/transactions', $base + ['amount' => 12.5, 'category_id' => $this->cat('Food')])
            ->assertJsonValidationErrors('amount');
        $this->postJson('/api/transactions', $base + ['amount' => 100, 'category_id' => $this->cat('Salary')])
            ->assertJsonValidationErrors('category_id');
    }

    public function test_duplicate_submission_with_same_client_ref_is_saved_once(): void
    {
        $ref = (string) Str::uuid();
        $first = $this->add(['client_ref' => $ref]);
        $second = $this->postJson('/api/transactions', [
            'type' => 'expense', 'amount' => 2500, 'scope' => 'personal', 'client_ref' => $ref,
            'category_id' => $this->cat('Food'), 'account_id' => $this->acct('Mobile Money'),
        ])->assertOk()->json();

        $this->assertSame($first['id'], $second['id']);
        $this->assertSame(1, $this->user->transactions()->count());
    }

    public function test_business_filtering_and_summary(): void
    {
        $this->add(['type' => 'income', 'amount' => 90000, 'scope' => 'business', 'business_id' => $this->biz('SneakersInn'), 'category_id' => $this->cat('Business Sales')]);
        $this->add(['amount' => 20000, 'scope' => 'business', 'business_id' => $this->biz('SneakersInn'), 'category_id' => $this->cat('Inventory / Stock')]);
        $this->add(['amount' => 5000, 'scope' => 'business', 'business_id' => $this->biz('MediaWura'), 'category_id' => $this->cat('Marketing / Advertising')]);
        $this->add(['amount' => 1500, 'description' => 'Trotro']); // personal

        $list = $this->getJson('/api/transactions?business_id='.$this->biz('SneakersInn'))->assertOk();
        $this->assertSame(2, $list->json('meta.total'));

        $this->getJson('/api/transactions?scope=personal')->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.description', 'Trotro');
        $this->getJson('/api/transactions?q=sneakers')->assertJsonPath('meta.total', 2);
        $this->getJson('/api/transactions?q=trotro')->assertJsonPath('meta.total', 1);
        $this->getJson('/api/transactions?type=income')->assertJsonPath('meta.total', 1);

        $overview = $this->getJson('/api/overview?scope=business')->assertOk();
        $this->assertSame(['income' => 90000, 'expense' => 25000, 'net' => 65000], $overview->json('today'));
        $biz = collect($overview->json('businesses'))->keyBy('name');
        $this->assertSame(70000, $biz['SneakersInn']['net']);
        $this->assertSame(-5000, $biz['MediaWura']['net']);

        $this->getJson('/api/overview?scope=business&business_id='.$this->biz('MediaWura'))
            ->assertJsonPath('today', ['income' => 0, 'expense' => 5000, 'net' => -5000]);
        $this->getJson('/api/overview?scope=personal')
            ->assertJsonPath('today.expense', 1500)->assertJsonPath('businesses', []);
    }

    public function test_personal_scope_clears_business(): void
    {
        $tx = $this->add(['scope' => 'personal', 'business_id' => $this->biz('Paylead')]);
        $this->assertNull($tx['business']);
    }

    public function test_daily_subtotals_in_list(): void
    {
        $this->add(['amount' => 1000, 'occurred_at' => '2025-10-14T09:00:00Z']);
        $this->add(['amount' => 2000]);
        $this->add(['type' => 'income', 'amount' => 7000, 'category_id' => $this->cat('Salary')]);

        $this->getJson('/api/transactions')->assertJsonPath('days.2025-10-15', ['income' => 7000, 'expense' => 2000])
            ->assertJsonPath('days.2025-10-14', ['income' => 0, 'expense' => 1000]);
        $this->getJson('/api/transactions?from=2025-10-14&to=2025-10-14')->assertJsonPath('meta.total', 1);
    }

    public function test_users_cannot_access_each_others_records(): void
    {
        $mine = $this->add();
        $other = $this->makeUser();
        Sanctum::actingAs($other);

        $this->getJson('/api/transactions')->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson("/api/transactions/{$mine['id']}")->assertNotFound();
        $this->patchJson("/api/transactions/{$mine['id']}", ['amount' => 1])->assertNotFound();
        $this->deleteJson("/api/transactions/{$mine['id']}")->assertNotFound();
        $this->patchJson('/api/accounts/'.$this->acct('Cash'), ['name' => 'Hacked'])->assertNotFound();
        $this->getJson('/api/overview')->assertJsonPath('today.expense', 0)->assertJsonPath('has_transactions', false);

        // Can't attach my transaction to someone else's account or category either.
        $this->postJson('/api/transactions', [
            'type' => 'expense', 'amount' => 100, 'scope' => 'personal',
            'category_id' => $this->cat('Food'), 'account_id' => $this->acct('Cash'),
        ])->assertJsonValidationErrors(['category_id', 'account_id']);

        $this->assertDatabaseHas('transactions', ['id' => $mine['id'], 'amount' => 2500]);
    }

    public function test_requests_without_token_are_rejected(): void
    {
        $this->app['auth']->forgetGuards();
        $this->withHeaders(['Authorization' => ''])->getJson('/api/transactions')->assertUnauthorized();
    }

    public function test_archiving_hides_but_keeps_history(): void
    {
        $this->add(['category_id' => $this->cat('Food')]);
        $this->patchJson('/api/categories/'.$this->cat('Food'), ['archived' => true])->assertOk()->assertJsonPath('archived', true);

        $names = collect($this->getJson('/api/categories')->json('data'))->pluck('name');
        $this->assertNotContains('Food', $names);
        $this->assertContains('Food', collect($this->getJson('/api/categories?include_archived=1')->json('data'))->pluck('name'));
        $this->getJson('/api/transactions')->assertJsonPath('data.0.category.name', 'Food');
    }
}
