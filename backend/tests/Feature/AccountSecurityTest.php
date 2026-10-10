<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
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
        $today = now('Africa/Accra')->toDateString();
        $this->withToken($token)->postJson('/api/review', ['date' => $today])
            ->assertOk()->assertJsonPath('last_reviewed_on', $today);
        $this->withToken($token)->getJson('/api/me')->assertJsonPath('last_reviewed_on', $today);
        // Can't back-fill old days to fake a streak.
        $this->withToken($token)->postJson('/api/review', ['date' => now('Africa/Accra')->subDays(3)->toDateString()])
            ->assertJsonValidationErrors('date');
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

    public function test_api_answers_json_even_without_accept_header(): void
    {
        $this->get('/api/me')->assertUnauthorized()->assertJsonPath('message', 'Unauthenticated.');
    }
}
