<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;
use Minishlink\WebPush\VAPID;

/**
 * Keys for Web Push. Uses VAPID_* from the environment when set; otherwise
 * generates a pair once and keeps it in storage so push works with zero setup.
 */
class VapidKeys
{
    private const FILE = 'vapid.json';

    /** @return array{public_key: string, private_key: string, subject: string}|null */
    public function get(): ?array
    {
        $config = config('services.webpush');
        $subject = $config['subject'] ?: 'mailto:admin@example.com';

        if (! empty($config['public_key']) && ! empty($config['private_key'])) {
            return ['public_key' => $config['public_key'], 'private_key' => $config['private_key'], 'subject' => $subject];
        }

        try {
            $disk = Storage::disk('local');
            if (! $disk->exists(self::FILE)) {
                $keys = VAPID::createVapidKeys();
                $disk->put(self::FILE, json_encode(['public_key' => $keys['publicKey'], 'private_key' => $keys['privateKey']]));
            }
            $stored = json_decode($disk->get(self::FILE), true);
        } catch (\Throwable $e) {
            report($e);

            return null;
        }

        return ['public_key' => $stored['public_key'], 'private_key' => $stored['private_key'], 'subject' => $subject];
    }
}
