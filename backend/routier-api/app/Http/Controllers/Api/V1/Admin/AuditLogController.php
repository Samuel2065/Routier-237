<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Consultation du journal d'audit (super_admin), en lecture seule : aucune entrée ne peut
 * être modifiée ni supprimée par l'API.
 */
class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->isSuperAdmin(), 403);

        $request->validate([
            'action' => ['sometimes', 'nullable', 'string', 'max:64'],
            'subject_type' => ['sometimes', 'nullable', 'string', 'max:32'],
            'subject_id' => ['sometimes', 'integer'],
            'actor_id' => ['sometimes', 'integer'],
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'date_from' => ['sometimes', 'date_format:Y-m-d'],
            'date_to' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:date_from'],
        ]);

        $search = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], trim((string) $request->query('search', '')));

        $entries = AuditLog::query()
            // Préfixe : « user. » regroupe toutes les actions sur les comptes.
            ->when($request->filled('action'), fn ($query) => $query->where('action', 'like', str_replace(['%', '_'], ['\\%', '\\_'], (string) $request->query('action')).'%'))
            ->when($request->filled('subject_type'), fn ($query) => $query->where('subject_type', $request->query('subject_type')))
            ->when($request->filled('subject_id'), fn ($query) => $query->where('subject_id', $request->integer('subject_id')))
            ->when($request->filled('actor_id'), fn ($query) => $query->where('actor_id', $request->integer('actor_id')))
            ->when($search !== '', fn ($query) => $query->where(fn ($query) => $query
                ->where('actor_name', 'like', "%{$search}%")
                ->orWhere('subject_label', 'like', "%{$search}%")))
            ->when($request->filled('date_from'), fn ($query) => $query->whereDate('created_at', '>=', $request->query('date_from')))
            ->when($request->filled('date_to'), fn ($query) => $query->whereDate('created_at', '<=', $request->query('date_to')))
            ->latest('id')
            ->paginate($this->perPage($request, 25))
            ->withQueryString()
            ->through(fn (AuditLog $entry) => [
                'id' => $entry->id,
                'action' => $entry->action,
                'actor' => $entry->actor_name === null ? null : [
                    'id' => $entry->actor_id,
                    'name' => $entry->actor_name,
                    'role' => $entry->actor_role,
                ],
                'subject' => $entry->subject_type === null ? null : [
                    'type' => $entry->subject_type,
                    'id' => $entry->subject_id,
                    'label' => $entry->subject_label,
                ],
                'metadata' => $entry->metadata ?? (object) [],
                'ip_address' => $entry->ip_address,
                'created_at' => $entry->created_at,
            ]);

        // Même forme que les autres listes paginées de l'API : { data, meta }.
        return response()->json([
            'data' => $entries->items(),
            'meta' => [
                'current_page' => $entries->currentPage(),
                'last_page' => $entries->lastPage(),
                'per_page' => $entries->perPage(),
                'total' => $entries->total(),
            ],
        ]);
    }
}
