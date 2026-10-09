<?php

namespace App\Models;

use App\Models\Concerns\Archivable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['name'])]
class Business extends Model
{
    use Archivable;

    protected function casts(): array
    {
        return ['archived_at' => 'datetime'];
    }
}
