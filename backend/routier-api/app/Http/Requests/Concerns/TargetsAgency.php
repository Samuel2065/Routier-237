<?php

namespace App\Http\Requests\Concerns;

use App\Models\Agency;

/**
 * Agence cible d'une création dans l'espace agence.
 *
 * Le personnel d'agence travaille par défaut dans sa propre agence ; un director
 * (plusieurs agences) doit préciser agency_id. Dans tous les cas, l'accès à
 * l'agence cible est contrôlé par la policy : l'identifiant envoyé n'est jamais
 * une preuve de droit.
 */
trait TargetsAgency
{
    public function targetAgency(): ?Agency
    {
        $id = $this->input('agency_id') ?? $this->user()->scopedAgencyId();

        return is_numeric($id) ? Agency::find((int) $id) : null;
    }

    /**
     * @return list<mixed>
     */
    protected function agencyIdRules(): array
    {
        return [
            $this->user()->scopedAgencyId() === null ? 'required' : 'sometimes',
            'integer',
            'exists:agencies,id',
        ];
    }

    /**
     * Autorise la création dans l'agence cible. Sans agence identifiable, on laisse
     * la validation signaler le champ manquant si l'utilisateur a la permission.
     */
    protected function authorizeForTargetAgency(string $modelClass, string $permission): bool
    {
        $agency = $this->targetAgency();

        if ($agency === null) {
            return $this->user()->checkPermissionTo($permission);
        }

        return $this->user()->can('create', [$modelClass, $agency]);
    }
}
