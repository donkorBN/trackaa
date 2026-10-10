<?php

namespace App\Services;

use App\Models\User;

/**
 * Business-only default categories stay out of the way for people without a business:
 * unused ones are hidden (archived, flagged auto_hidden) while a user has no active
 * business, and come back as soon as they add one. Categories the user archived
 * themselves, or has used, are never touched.
 */
class BusinessCategories
{
    public const NAMES = [
        'Business Sales', 'Marketing / Advertising', 'Inventory / Stock',
        'Business Operations', 'Staff / Contractors', 'Delivery',
    ];

    public function sync(User $user): void
    {
        if ($user->businesses()->active()->exists()) {
            $user->categories()->where('auto_hidden', true)->update(['archived_at' => null, 'auto_hidden' => false]);

            return;
        }

        $user->categories()
            ->active()
            ->whereIn('name', self::NAMES)
            ->whereDoesntHave('transactions')
            ->update(['archived_at' => now(), 'auto_hidden' => true]);
    }
}
