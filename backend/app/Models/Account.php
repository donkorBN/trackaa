<?php

namespace App\Models;

use App\Models\Concerns\Archivable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'account_type', 'opening_balance'])]
class Account extends Model
{
    use Archivable;

    public const TYPES = ['mobile_money', 'cash', 'bank', 'other'];

    protected function casts(): array
    {
        return ['opening_balance' => 'integer', 'archived_at' => 'datetime'];
    }

    public function statements(): HasMany
    {
        return $this->hasMany(Statement::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
