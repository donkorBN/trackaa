<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

class AccountSecurityTest extends TestCase
{
    use RefreshDatabase;

    private function register(string $email = 'ama@example.com'): array
    {
        return $this->postJson('/api/auth/register', [
            'name' => 'Ama', 'email' => $email, 'password' => 'secret-pass', 'password_confirmation' => 'secret-pass',
        ])->assertCreated()->json();
    }

    public function test_tokens_expire_and_slide_forward_with_use(): void
    {
        $token = $this->register()['token'];
        $pat = PersonalAccessToken::findToken($token);
        $this->assertTrue($pat->expires_at->between(now()->addDays(89), now()->addDays(91)));

        $this->travel(30)->days();
        $this->withToken($token)->getJson('/api/me')->assertOk();
        $this->assertTrue($pat->fresh()->expires_at->gt(now()->addDays(89)));

        $this->travel(91)->days();
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/me')->assertUnauthorized();
    }

    public function test_forgot_and_reset_password(): void
    {
        Notification::fake();
        $oldToken = $this->register()['token'];

        $this->postJson('/api/auth/forgot-password', ['email' => 'nobody@example.com'])->assertOk();
        $this->postJson('/api/auth/forgot-password', ['email' => 'AMA@example.com'])->assertOk();

        $user = User::where('email', 'ama@example.com')->first();
        $resetToken = null;
        Notification::assertSentTo($user, ResetPassword::class, function ($n) use (&$resetToken, $user) {
            $resetToken = $n->token;
            $this->assertStringStartsWith('http://localhost:3000/reset-password/?token=', $n->toMail($user)->actionUrl);

            return true;
        });

        $this->postJson('/api/auth/reset-password', [
            'token' => 'wrong', 'email' => 'ama@example.com', 'password' => 'new-pass-123', 'password_confirmation' => 'new-pass-123',
        ])->assertUnprocessable();

        $res = $this->postJson('/api/auth/reset-password', [
            'token' => $resetToken, 'email' => 'ama@example.com', 'password' => 'new-pass-123', 'password_confirmation' => 'new-pass-123',
        ])->assertOk();
        $this->assertNotEmpty($res->json('token'));

        $this->app['auth']->forgetGuards();
        $this->withToken($oldToken)->getJson('/api/me')->assertUnauthorized(); // old sessions signed out
        $this->postJson('/api/auth/login', ['email' => 'ama@example.com', 'password' => 'new-pass-123'])->assertOk();
    }

    public function test_change_password_requires_current_password(): void
    {
        $token = $this->register()['token'];
        $other = $this->postJson('/api/auth/login', ['email' => 'ama@example.com', 'password' => 'secret-pass'])->json('token');

        $this->withToken($token)->putJson('/api/me/password', [
            'current_password' => 'nope', 'password' => 'new-pass-123', 'password_confirmation' => 'new-pass-123',
        ])->assertJsonValidationErrors('current_password');

        $this->withToken($token)->putJson('/api/me/password', [
            'current_password' => 'secret-pass', 'password' => 'new-pass-123', 'password_confirmation' => 'new-pass-123',
        ])->assertNoContent();

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/me')->assertOk(); // this device stays in
        $this->app['auth']->forgetGuards();
        $this->withToken($other)->getJson('/api/me')->assertUnauthorized(); // others signed out
    }

    public function test_review_is_stored_on_server(): void
    {
        $token = $this->register()['token'];
        $this->withToken($token)->postJson('/api/review', ['date' => '2026-10-09'])
            ->assertOk()->assertJsonPath('last_reviewed_on', '2026-10-09');
        $this->withToken($token)->getJson('/api/me')->assertJsonPath('last_reviewed_on', '2026-10-09');
    }

    public function test_categories_report_recent_usage_and_csv_export(): void
    {
        $token = $this->register()['token'];
        $user = User::first();
        $food = $user->categories()->where('name', 'Food')->value('id');
        $cash = $user->accounts()->where('name', 'Cash')->value('id');
        foreach ([1250, 300] as $amount) {
            $this->withToken($token)->postJson('/api/transactions', [
                'type' => 'expense', 'amount' => $amount, 'scope' => 'personal', 'category_id' => $food,
                'account_id' => $cash, 'description' => 'Kelewele, "spicy"',
            ])->assertCreated();
        }

        $cats = collect($this->withToken($token)->getJson('/api/categories')->json('data'))->keyBy('name');
        $this->assertSame(2, $cats['Food']['usage_count']);
        $this->assertSame(0, $cats['Transport']['usage_count']);

        $csv = $this->withToken($token)->get('/api/transactions/export')->assertOk()->streamedContent();
        $lines = array_values(array_filter(explode("\n", trim($csv))));
        $this->assertStringContainsString('Amount (GHS)', $lines[0]);
        $this->assertCount(3, $lines);
        $this->assertStringContainsString('-12.50', $csv);
        $this->assertStringContainsString('-3.00', $csv);
        $this->assertStringContainsString('"Kelewele, ""spicy"""', $csv);

        // Another user's export is empty.
        $this->app['auth']->forgetGuards();
        $otherToken = $this->register('kofi@example.com')['token'];
        $this->app['auth']->forgetGuards();
        $other = $this->withToken($otherToken)->get('/api/transactions/export')->streamedContent();
        $this->assertCount(1, array_filter(explode("\n", trim($other))));
    }

    public function test_push_key_is_generated_automatically(): void
    {
        config(['services.webpush.public_key' => null, 'services.webpush.private_key' => null]);
        Storage::fake('local');
        $token = $this->register()['token'];
        $key = $this->withToken($token)->getJson('/api/push/key')->assertOk()->json('public_key');
        $this->assertNotEmpty($key);
        $this->assertSame($key, $this->withToken($token)->getJson('/api/push/key')->json('public_key'));
        $this->assertDatabaseCount('app_settings', 1); // stored in the database, so it survives restarts
    }

    public function test_api_answers_json_even_without_accept_header(): void
    {
        $this->get('/api/me')->assertUnauthorized()->assertJsonPath('message', 'Unauthenticated.');
    }

    public function test_cron_endpoint_requires_the_secret(): void
    {
        config(['services.cron.secret' => null]);
        $this->getJson('/api/cron/reminders')->assertNotFound(); // disabled when no secret is set

        config(['services.cron.secret' => 'shh-123']);
        $this->getJson('/api/cron/reminders?token=wrong')->assertNotFound();
        $this->getJson('/api/cron/reminders?token=shh-123')->assertOk()->assertJsonPath('ok', true);
        $this->withToken('shh-123')->getJson('/api/cron/reminders')->assertOk();
    }
}
