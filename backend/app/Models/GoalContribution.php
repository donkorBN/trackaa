<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['amount', 'occurred_on', 'note'])]
class GoalContribution extends Model
{
    protected function casts(): array
    {
        return ['amount' => 'integer', 'occurred_on' => 'date'];
    }

    public function goal(): BelongsTo
    {
        return $this->belongsTo(Goal::class);
    }
}
