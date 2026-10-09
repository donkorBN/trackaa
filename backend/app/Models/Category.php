<?php

namespace App\Models;

use App\Models\Concerns\Archivable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['name', 'transaction_type'])]
class Category extends Model
{
    use Archivable;

    protected function casts(): array
    {
        return ['archived_at' => 'datetime'];
    }
}
