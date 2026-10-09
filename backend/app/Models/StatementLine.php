<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['occurred_at', 'amount', 'description', 'reference', 'balance', 'status', 'transaction_id'])]
class StatementLine extends Model
{
    protected function casts(): array
    {
        return ['occurred_at' => 'datetime', 'amount' => 'integer', 'balance' => 'integer'];
    }

    public function statement(): BelongsTo
    {
        return $this->belongsTo(Statement::class);
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }
}
