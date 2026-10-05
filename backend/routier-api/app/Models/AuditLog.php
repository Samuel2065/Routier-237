<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Arr;

/**
 * Entrée du journal d'audit des actions sensibles (lecture : super_admin uniquement).
 *
 * Écrite par AuditLog::record() au moment de l'action ; jamais modifiée ensuite.
 */
class AuditLog extends Model
{
    public const UPDATED_AT = null;

    /** Clés jamais conservées dans les métadonnées, même par erreur. */
    private const FORBIDDEN_KEYS = ['password', 'password_confirmation', 'token', 'remember_token', 'secret', 'api_key'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /**
     * Enregistre une action de l'utilisateur connecté (ou de $actor) sur un élément.
     *
     * @param  array<string, mixed>  $metadata  détails non sensibles (statuts, champs modifiés…)
     */
    public static function record(string $action, ?Model $subject = null, array $metadata = [], ?User $actor = null): self
    {
        $actor ??= request()->user();

        $entry = new self;
        $entry->forceFill([
            'actor_id' => $actor?->getKey(),
            'actor_name' => $actor?->name,
            'actor_role' => $actor?->primaryRole()?->value,
            'action' => $action,
            'subject_type' => $subject ? self::subjectType($subject) : null,
            'subject_id' => $subject?->getKey(),
            'subject_label' => $subject ? self::subjectLabel($subject) : null,
            'metadata' => Arr::except($metadata, self::FORBIDDEN_KEYS) ?: null,
            'ip_address' => request()->ip(),
        ])->save();

        return $entry;
    }

    /**
     * Enregistre la modification d'un élément qui vient d'être sauvegardé : champs modifiés
     * (noms seulement) et, si le statut a changé, suspension ou réactivation.
     * Rien n'est enregistré si aucun champ n'a changé.
     */
    public static function recordUpdate(string $prefix, Model $subject): ?self
    {
        $fields = array_values(array_diff(array_keys($subject->getChanges()), ['updated_at']));

        if ($fields === []) {
            return null;
        }

        $metadata = ['fields' => $fields];
        $action = "{$prefix}.updated";

        if (in_array('status', $fields, true)) {
            $to = (string) $subject->getAttributes()['status'];
            $metadata['status'] = ['from' => $subject->getPrevious()['status'] ?? null, 'to' => $to];
            $action = $to === 'active' ? "{$prefix}.reactivated" : "{$prefix}.suspended";
        }

        return self::record($action, $subject, $metadata);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    private static function subjectType(Model $subject): string
    {
        return match (true) {
            $subject instanceof User => 'user',
            $subject instanceof Organization => 'organization',
            $subject instanceof Agency => 'agency',
            $subject instanceof EmployeeProfile => 'employee',
            $subject instanceof Reservation => 'reservation',
            $subject instanceof Payment => 'payment',
            $subject instanceof Trip => 'trip',
            default => class_basename($subject),
        };
    }

    private static function subjectLabel(Model $subject): ?string
    {
        return match (true) {
            $subject instanceof User => "{$subject->name} ({$subject->email})",
            $subject instanceof EmployeeProfile => $subject->user?->name,
            $subject instanceof Reservation => $subject->reference,
            $subject instanceof Payment => "Paiement {$subject->amount} FCFA",
            $subject instanceof Trip => "Trajet n° {$subject->id} du {$subject->departure_date?->format('d/m/Y')}",
            default => $subject->getAttribute('name'),
        };
    }
}
