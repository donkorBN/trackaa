<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['day', 'kind'])]
class ActivityDay extends Model
{
    protected function casts(): array
    {
        return ['day' => 'date'];
    }
}
