<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'type', 'amount', 'scope', 'business_id', 'category_id', 'account_id',
    'to_account_id', 'description', 'occurred_at', 'client_ref',
])]
class Transaction extends Model
{
    public const TYPES = ['income', 'expense', 'transfer'];

    public const SCOPES = ['personal', 'business'];

    protected function casts(): array
    {
        return ['amount' => 'integer', 'occurred_at' => 'datetime'];
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function toAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'to_account_id');
    }

    public function toApi(): array
    {
        $ref = fn ($m) => $m ? ['id' => $m->id, 'name' => $m->name] : null;

        return [
            'id' => $this->id,
            'type' => $this->type,
            'amount' => $this->amount,
            'scope' => $this->scope,
            'business' => $ref($this->business),
            'category' => $ref($this->category),
            'account' => $ref($this->account),
            'to_account' => $ref($this->toAccount),
            'description' => $this->description,
            'occurred_at' => $this->occurred_at->toIso8601ZuluString(),
            'created_at' => $this->created_at->toIso8601ZuluString(),
        ];
    }
}
