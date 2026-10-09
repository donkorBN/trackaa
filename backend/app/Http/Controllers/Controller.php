<?php

namespace App\Http\Controllers;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

abstract class Controller
{
    /** Every record belongs to one user; others get a 404, not a hint it exists. */
    protected function authorizeOwner(Request $request, Model $model): void
    {
        abort_unless((int) $model->getAttribute('user_id') === (int) $request->user()->id, 404);
    }
}
