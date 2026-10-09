<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['account_id', 'period', 'source_name', 'opening_balance', 'closing_balance'])]
class Statement extends Model
{
    protected function casts(): array
    {
        return ['opening_balance' => 'integer', 'closing_balance' => 'integer'];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(StatementLine::class);
    }
}
