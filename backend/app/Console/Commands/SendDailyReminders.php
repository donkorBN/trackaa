<?php

namespace App\Console\Commands;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

class SendDailyReminders extends Command
{
    protected $signature = 'reminders:send';

    protected $description = 'Send the daily "record your transactions" push reminder to users whose reminder time has passed';

    public function handle(): int
    {
        $config = config('services.webpush');
        if (empty($config['public_key']) || empty($config['private_key'])) {
            $this->warn('VAPID keys are not configured; skipping push reminders.');

            return self::SUCCESS;
        }

        $webPush = new WebPush(['VAPID' => [
            'subject' => $config['subject'],
            'publicKey' => $config['public_key'],
            'privateKey' => $config['private_key'],
        ]]);

        $sent = 0;
        User::where('reminder_enabled', true)->whereHas('pushSubscriptions')->with('pushSubscriptions')
            ->each(function (User $user) use ($webPush, &$sent) {
                $now = CarbonImmutable::now($user->timezone);
                $today = $now->toDateString();
                if ($now->format('H:i') < $user->reminder_time || $user->last_reminded_on?->toDateString() === $today) {
                    return;
                }

                $payload = json_encode([
                    'title' => 'Trackaa',
                    'body' => 'Have you recorded everything you earned and spent today?',
                    'url' => '/review',
                ]);
                foreach ($user->pushSubscriptions as $sub) {
                    $webPush->queueNotification(Subscription::create([
                        'endpoint' => $sub->endpoint,
                        'publicKey' => $sub->public_key,
                        'authToken' => $sub->auth_token,
                    ]), $payload);
                }
                foreach ($webPush->flush() as $report) {
                    if ($report->isSubscriptionExpired()) {
                        $user->pushSubscriptions()->where('endpoint', $report->getEndpoint())->delete();
                    }
                }

                $user->forceFill(['last_reminded_on' => $today])->save();
                $sent++;
            });

        $this->info("Reminders sent to {$sent} user(s).");

        return self::SUCCESS;
    }
}
