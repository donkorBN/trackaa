<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\DefaultSetup;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProgressTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['timezone' => 'Africa/Accra']);
        app(DefaultSetup::class)->provision($this->user);
        Sanctum::actingAs($this->user);
    }

    private function logOn(string $datetime): void
    {
        $this->travelTo(CarbonImmutable::parse($datetime, 'UTC'));
        $this->postJson('/api/transactions', [
            'type' => 'expense', 'amount' => 500, 'scope' => 'personal',
            'category_id' => $this->user->categories()->where('name', 'Food')->value('id'),
            'account_id' => $this->user->accounts()->where('name', 'Cash')->value('id'),
        ])->assertCreated();
    }

    public function test_streak_counts_consecutive_days_and_survives_until_today_ends(): void
    {
        $this->logOn('2026-10-05 09:00');
        $this->logOn('2026-10-06 09:00');
        $this->logOn('2026-10-06 18:00'); // same day: still one day
        $this->logOn('2026-10-07 09:00');

        // Next morning, nothing logged yet: streak alive but at risk.
        $this->travelTo(CarbonImmutable::parse('2026-10-08 08:00', 'UTC'));
        $this->getJson('/api/progress')->assertOk()
            ->assertJsonPath('streak', 3)->assertJsonPath('today_done', false)->assertJsonPath('at_risk', true)
            ->assertJsonPath('best_streak', 3)->assertJsonPath('active_days', 3);

        // "No spending today" check-in keeps it going.
        $this->postJson('/api/review', ['date' => '2026-10-08'])->assertOk();
        $res = $this->getJson('/api/progress')->assertJsonPath('streak', 4)->assertJsonPath('today_done', true);
        $week = collect($res->json('week'))->keyBy('date');
        $this->assertSame('logged', $week['2026-10-06']['state']);
        $this->assertSame('checkin', $week['2026-10-08']['state']);
        $this->assertSame('logged', $week['2026-10-05']['state']);
        $this->assertSame('future', $week['2026-10-11']['state']);

        // Missing a whole day breaks it; best streak is remembered.
        $this->logOn('2026-10-10 09:00');
        $this->getJson('/api/progress')->assertJsonPath('streak', 1)->assertJsonPath('best_streak', 4);
    }

    public function test_levels_and_badges_follow_real_activity(): void
    {
        $res = $this->getJson('/api/progress')->assertOk();
        $this->assertSame(1, $res->json('level.number'));
        $this->assertSame('Newcomer', $res->json('level.name'));
        $this->assertFalse(collect($res->json('badges'))->firstWhere('key', 'first_log')['earned']);

        foreach (['2026-10-01', '2026-10-02', '2026-10-03'] as $d) {
            $this->logOn("$d 10:00");
        }
        $this->postJson('/api/budgets', ['amount' => 100000])->assertCreated();
        $this->postJson('/api/businesses', ['name' => 'My Shop'])->assertCreated();

        $res = $this->getJson('/api/progress');
        $this->assertSame('Starter', $res->json('level.name'));
        $this->assertSame(4, $res->json('level.days_for_next')); // 3 -> 7 active days
        $badges = collect($res->json('badges'))->keyBy('key');
        foreach (['first_log', 'streak_3', 'planner', 'boss'] as $k) {
            $this->assertTrue($badges[$k]['earned'], $k);
        }
        $this->assertFalse($badges['streak_7']['earned']);
        $this->assertSame(['current' => 3, 'target' => 7], $badges['streak_7']['progress']);
    }

    public function test_unused_items_can_be_deleted_but_used_ones_must_be_archived(): void
    {
        $shop = $this->postJson('/api/businesses', ['name' => 'Kiosk'])->json('id');
        $this->deleteJson("/api/businesses/{$shop}")->assertNoContent();

        $used = $this->user->categories()->where('name', 'Food')->value('id');
        $this->logOn('2026-10-01 10:00');
        $this->deleteJson("/api/categories/{$used}")->assertStatus(422);
        $cash = $this->user->accounts()->where('name', 'Cash')->value('id');
        $this->deleteJson("/api/accounts/{$cash}")->assertStatus(422);
        $bank = $this->user->accounts()->where('name', 'Bank')->value('id');
        $this->deleteJson("/api/accounts/{$bank}")->assertNoContent();

        $other = User::factory()->create();
        $theirs = $other->businesses()->create(['name' => 'Theirs'])->id;
        $this->deleteJson("/api/businesses/{$theirs}")->assertNotFound();
    }
}
