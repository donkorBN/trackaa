<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;

trait Archivable
{
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('archived_at');
    }

    public function isArchived(): bool
    {
        return $this->archived_at !== null;
    }

    public function setArchived(bool $archived): void
    {
        $this->archived_at = $archived ? ($this->archived_at ?? now()) : null;
    }
}
