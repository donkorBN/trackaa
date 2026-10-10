<?php

namespace Tests\Feature;

use App\Models\AccessCode;
use App\Models\User;
use App\Services\BusinessCategories;
use App\Services\DefaultSetup;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class GoLiveTest extends TestCase
{
    use RefreshDatabase;

    private function register(array $extra = [])
    {
        return $this->postJson('/api/auth/register', $extra + [
            'name' => 'Ama', 'email' => 'ama@example.com', 'password' => 'password123', 'password_confirmation' => 'password123',
        ]);
    }

    public function test_meta_reports_mail_signup_and_buy_settings(): void
    {
        config(['mail.default' => 'log', 'trackaa.signup' => 'open', 'trackaa.buy_url' => null, 'trackaa.price_label' => null]);
        $this->getJson('/api/meta')->assertOk()->assertExactJson([
            'mail_enabled' => false, 'access_code_required' => false, 'buy_url' => null, 'price_label' => null,
        ]);

        config(['mail.default' => 'smtp', 'trackaa.signup' => 'code', 'trackaa.buy_url' => 'https://paystack.com/pay/trackaa', 'trackaa.price_label' => 'GH₵ 50, one-time']);
        $this->getJson('/api/meta')->assertExactJson([
            'mail_enabled' => true, 'access_code_required' => true,
            'buy_url' => 'https://paystack.com/pay/trackaa', 'price_label' => 'GH₵ 50, one-time',
        ]);
    }

    public function test_each_access_code_creates_exactly_one_account(): void
    {
        config(['trackaa.signup' => 'code']);
        $code = AccessCode::create(['code' => AccessCode::generate()]);
        $this->assertMatchesRegularExpression('/^TRK-[2-9A-HJKMNPR-Z]{4}-[2-9A-HJKMNPR-Z]{4}$/', $code->code);

        $this->register()->assertUnprocessable()->assertJsonValidationErrors('access_code');
        $this->register(['access_code' => 'TRK-AAAA-AAAA'])->assertUnprocessable()->assertJsonValidationErrors('access_code');
        $this->assertDatabaseCount('users', 0);

        // Sloppy typing is fine: lower case, spaces, no dashes.
        $sloppy = strtolower(str_replace('-', ' ', $code->code));
        $this->register(['access_code' => $sloppy])->assertCreated();
        $user = User::firstOrFail();
        $this->assertSame($user->id, $code->fresh()->redeemed_by);
        $this->assertNotNull($code->fresh()->redeemed_at);

        // Used codes can't be reused.
        $this->register(['email' => 'kofi@example.com', 'access_code' => $code->code])
            ->assertUnprocessable()->assertJsonValidationErrors('access_code');

        // Revoked codes don't work either.
        $revoked = AccessCode::create(['code' => AccessCode::generate()]);
        $revoked->forceFill(['revoked_at' => now()])->save();
        $this->register(['email' => 'kofi@example.com', 'access_code' => $revoked->code])->assertUnprocessable();
        $this->assertDatabaseCount('users', 1);
    }

    public function test_open_signup_needs_no_code(): void
    {
        config(['trackaa.signup' => 'open']);
        $this->register()->assertCreated();
    }

    public function test_only_admins_can_manage_codes(): void
    {
        config(['trackaa.admin_emails' => ['boss@example.com']]);
        $boss = User::factory()->create(['email' => 'boss@example.com']);
        $someone = User::factory()->create();

        Sanctum::actingAs($someone);
        $this->getJson('/api/admin/codes')->assertNotFound();
        $this->postJson('/api/admin/codes', ['count' => 5])->assertNotFound();
        $this->getJson('/api/me')->assertJsonPath('is_admin', false);

        Sanctum::actingAs($boss);
        $this->getJson('/api/me')->assertJsonPath('is_admin', true);
        $made = $this->postJson('/api/admin/codes', ['count' => 3, 'note' => 'Ad test batch'])->assertCreated()->json('data');
        $this->assertCount(3, $made);
        $this->assertCount(3, array_unique(array_column($made, 'code')));
        $this->postJson('/api/admin/codes', ['count' => 500])->assertUnprocessable();

        $this->patchJson("/api/admin/codes/{$made[0]['id']}", ['revoked' => true, 'note' => 'Refunded'])
            ->assertOk()->assertJsonPath('status', 'revoked')->assertJsonPath('note', 'Refunded');
        $this->getJson('/api/admin/codes?status=available')->assertJsonCount(2, 'data');
        $this->getJson('/api/admin/codes?q=refund')->assertJsonCount(1, 'data');
        $this->getJson('/api/admin/stats')->assertJsonPath('codes_available', 2)->assertJsonPath('codes_revoked', 1)->assertJsonPath('users', 2);

        // A redeemed code can't be revoked afterwards.
        config(['trackaa.signup' => 'code']);
        auth()->forgetGuards();
        $this->register(['access_code' => $made[1]['code']])->assertCreated();
        Sanctum::actingAs($boss);
        $this->getJson('/api/admin/codes?status=redeemed')->assertJsonCount(1, 'data')->assertJsonPath('data.0.redeemed_by.email', 'ama@example.com');
        $this->patchJson("/api/admin/codes/{$made[1]['id']}", ['revoked' => true])->assertUnprocessable();
    }

    public function test_business_categories_hide_until_a_business_exists_and_respect_user_choices(): void
    {
        $this->register()->assertCreated();
        $user = User::firstOrFail();
        Sanctum::actingAs($user);
        $names = fn () => collect($this->getJson('/api/categories')->json('data'))->pluck('name');

        // Personal-only: business categories are out of Quick Add.
        $this->assertNotContains('Inventory / Stock', $names());
        $this->assertNotContains('Business Sales', $names());
        $this->assertContains('Food', $names());

        // Adding a business brings them back.
        $biz = $this->postJson('/api/businesses', ['name' => 'Kente Co'])->assertCreated()->json('id');
        $this->assertContains('Inventory / Stock', $names());
        $this->assertContains('Business Sales', $names());

        // The user archives one themselves; it must stay archived.
        $delivery = $user->categories()->where('name', 'Delivery')->value('id');
        $this->patchJson("/api/categories/{$delivery}", ['archived' => true])->assertOk();

        // Used categories are never hidden.
        $this->postJson('/api/transactions', [
            'type' => 'expense', 'amount' => 1000, 'scope' => 'business', 'business_id' => $biz,
            'category_id' => $user->categories()->where('name', 'Marketing / Advertising')->value('id'),
            'account_id' => $user->accounts()->where('name', 'Cash')->value('id'),
        ])->assertCreated();

        // Archiving the only business hides the unused ones again.
        $this->patchJson("/api/businesses/{$biz}", ['archived' => true])->assertOk();
        $this->assertNotContains('Inventory / Stock', $names());
        $this->assertContains('Marketing / Advertising', $names());

        // Restoring it brings back what was auto-hidden, but not what the user archived.
        $this->patchJson("/api/businesses/{$biz}", ['archived' => false])->assertOk();
        $this->assertContains('Inventory / Stock', $names());
        $this->assertNotContains('Delivery', $names());
    }

    public function test_deleting_the_account_removes_everything_and_needs_the_password(): void
    {
        $user = User::factory()->create(['password' => 'password123', 'timezone' => 'Africa/Accra']);
        app(DefaultSetup::class)->provision($user);
        $other = User::factory()->create();
        app(DefaultSetup::class)->provision($other);
        Sanctum::actingAs($user);

        $cash = $user->accounts()->where('name', 'Cash')->value('id');
        $biz = $this->postJson('/api/businesses', ['name' => 'Shop'])->json('id');
        $this->postJson('/api/transactions', [
            'type' => 'expense', 'amount' => 500, 'scope' => 'business', 'business_id' => $biz,
            'category_id' => $user->categories()->where('name', 'Food')->value('id'), 'account_id' => $cash,
        ])->assertCreated();
        $this->postJson('/api/budgets', ['amount' => 100000])->assertCreated();
        $goal = $this->postJson('/api/goals', ['name' => 'Laptop', 'target_amount' => 500000])->assertCreated()->json('id');
        $this->postJson("/api/goals/{$goal}/contributions", ['amount' => 10000])->assertSuccessful();
        $this->postJson('/api/statements', [
            'account_id' => $cash, 'period' => '2026-10',
            'lines' => [['occurred_at' => '2026-10-02 10:00:00', 'amount' => -500, 'description' => 'Lunch']],
        ])->assertSuccessful();
        $this->postJson('/api/review', ['date' => now('Africa/Accra')->toDateString()]);

        $this->deleteJson('/api/me', ['password' => 'wrong'])->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->deleteJson('/api/me', ['password' => 'password123'])->assertNoContent();

        $this->assertDatabaseMissing('users', ['id' => $user->id]);
        foreach (['accounts', 'businesses', 'categories', 'transactions', 'budgets', 'goals', 'statements', 'activity_days'] as $table) {
            $this->assertSame(0, DB::table($table)->where('user_id', $user->id)->count(), $table);
        }
        $this->assertSame(0, DB::table('personal_access_tokens')->where('tokenable_id', $user->id)->count());
        // Nobody else is affected.
        $this->assertTrue($other->accounts()->exists());
        $this->assertTrue($other->categories()->exists());
    }

    public function test_sync_is_safe_to_run_repeatedly_for_existing_users(): void
    {
        $user = User::factory()->create();
        app(DefaultSetup::class)->provision($user);
        $sync = app(BusinessCategories::class);
        $sync->sync($user);
        $sync->sync($user);
        $this->assertSame(6, $user->categories()->where('auto_hidden', true)->count());
    }
}
