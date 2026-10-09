<?php

namespace App\Models;

use App\Models\Concerns\Archivable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'target_amount', 'target_date', 'color'])]
class Goal extends Model
{
    use Archivable;

    protected function casts(): array
    {
        return ['target_amount' => 'integer', 'target_date' => 'date', 'archived_at' => 'datetime'];
    }

    public function contributions(): HasMany
    {
        return $this->hasMany(GoalContribution::class);
    }
}
