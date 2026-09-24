<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Génère un slug unique pour une table (ex. « routier-voyages », « routier-voyages-2 »).
 */
final class UniqueSlug
{
    /**
     * @param  class-string<Model>  $model
     */
    public static function for(string $model, string $value, ?int $ignoreId = null, string $column = 'slug'): string
    {
        $base = Str::slug($value) ?: 'item';
        $slug = $base;
        $suffix = 2;

        while ($model::query()
            ->where($column, $slug)
            ->when($ignoreId, fn ($query) => $query->whereKeyNot($ignoreId))
            ->exists()) {
            $slug = $base.'-'.$suffix++;
        }

        return $slug;
    }
}
