<?php

namespace Tests\Feature;

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
        return $this->postJson('/api/auth/register', [
            'name' => 'Ama', 'email' => 'ama@example.com', 'password' => 'password123', 'password_confirmation' => 'password123',
        ] + $extra);
    }

    public function test_meta_reports_mail_and_invite_settings(): void
    {
        config(['mail.default' => 'log', 'trackaa.invite_code' => null]);
        $this->getJson('/api/meta')->assertOk()->assertExactJson(['mail_enabled' => false, 'invite_required' => false]);

        config(['mail.default' => 'smtp', 'trackaa.invite_code' => 'friends-only']);
        $this->getJson('/api/meta')->assertExactJson(['mail_enabled' => true, 'invite_required' => true]);
    }

    public function test_invite_code_gates_registration_when_set(): void
    {
        config(['trackaa.invite_code' => 'friends-only']);
        $this->register()->assertUnprocessable()->assertJsonValidationErrors('invite_code');
        $this->register(['invite_code' => 'wrong'])->assertUnprocessable()->assertJsonValidationErrors('invite_code');
        $this->assertDatabaseCount('users', 0);
        $this->register(['invite_code' => ' friends-only '])->assertCreated();
    }

    public function test_registration_is_open_without_a_code(): void
    {
        config(['trackaa.invite_code' => null]);
        $this->register()->assertCreated();
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
