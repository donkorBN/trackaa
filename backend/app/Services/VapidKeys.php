<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Minishlink\WebPush\VAPID;

/**
 * Keys for Web Push. Uses VAPID_* from the environment when set; otherwise
 * generates a pair once and keeps it in the database, so push works with zero
 * setup even on hosts whose disk is wiped on every deploy (Render, Heroku...).
 */
class VapidKeys
{
    private const KEY = 'vapid_keys';

    /** @return array{public_key: string, private_key: string, subject: string}|null */
    public function get(): ?array
    {
        $config = config('services.webpush');
        $subject = $config['subject'] ?: 'mailto:admin@example.com';

        if (! empty($config['public_key']) && ! empty($config['private_key'])) {
            return ['public_key' => $config['public_key'], 'private_key' => $config['private_key'], 'subject' => $subject];
        }

        try {
            $stored = DB::table('app_settings')->where('key', self::KEY)->value('value');
            if (! $stored) {
                $keys = VAPID::createVapidKeys();
                $stored = json_encode(['public_key' => $keys['publicKey'], 'private_key' => $keys['privateKey']]);
                // insertOrIgnore: if two requests race, the first pair wins and both read it back.
                DB::table('app_settings')->insertOrIgnore(['key' => self::KEY, 'value' => $stored, 'created_at' => now(), 'updated_at' => now()]);
                $stored = DB::table('app_settings')->where('key', self::KEY)->value('value');
            }
            $keys = json_decode($stored, true);
        } catch (\Throwable $e) {
            report($e);

            return null;
        }

        return ['public_key' => $keys['public_key'], 'private_key' => $keys['private_key'], 'subject' => $subject];
    }
}
