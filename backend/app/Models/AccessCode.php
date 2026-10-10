<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A single-use code that lets one person create an account. */
#[Fillable(['code', 'note', 'created_by'])]
class AccessCode extends Model
{
    // No 0/O/Q/1/I/L: codes get read out over the phone and typed on small keyboards.
    private const ALPHABET = '23456789ABCDEFGHJKMNPRSTUVWXYZ';

    protected function casts(): array
    {
        return ['redeemed_at' => 'datetime', 'revoked_at' => 'datetime'];
    }

    public function redeemer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'redeemed_by');
    }

    /** TRK-XXXX-XXXX: 8 random characters from 30, about 6.6 * 10^11 combinations. */
    public static function generate(): string
    {
        do {
            $chars = '';
            for ($i = 0; $i < 8; $i++) {
                $chars .= self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)];
            }
            $code = 'TRK-'.substr($chars, 0, 4).'-'.substr($chars, 4);
        } while (self::where('code', $code)->exists());

        return $code;
    }

    /** Accepts sloppy input: lower case, spaces, missing dashes or prefix. */
    public static function normalize(string $input): string
    {
        $raw = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $input) ?? '');
        if (str_starts_with($raw, 'TRK')) {
            $raw = substr($raw, 3);
        }

        return strlen($raw) === 8 ? 'TRK-'.substr($raw, 0, 4).'-'.substr($raw, 4) : $raw;
    }

    public function status(): string
    {
        return match (true) {
            $this->revoked_at !== null => 'revoked',
            $this->redeemed_at !== null => 'redeemed',
            default => 'available',
        };
    }
}
