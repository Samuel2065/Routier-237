<?php

namespace App\Http\Controllers;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

abstract class Controller
{
    /**
     * Taille de page demandée (?per_page=), bornée pour éviter les réponses trop lourdes.
     */
    protected function perPage(Request $request, int $default = 15, int $max = 100): int
    {
        return max(1, min($max, $request->integer('per_page', $default)));
    }

    /**
     * Filtre texte simple sur une colonne (?search=).
     */
    protected function applySearch(Builder $query, Request $request, string $column = 'name'): Builder
    {
        $search = trim((string) $request->query('search', ''));

        if ($search === '') {
            return $query;
        }

        $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search);

        return $query->where($column, 'like', '%'.$escaped.'%');
    }
}
