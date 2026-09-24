<?php

namespace App\Http\Requests\Agencies;

use App\Enums\PermissionName;
use App\Enums\RecordStatus;
use App\Models\Agency;
use App\Models\Organization;
use App\Support\Phone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Création d'une agence.
 *
 * - Director (espace agence) : l'organisation est la sienne ; organization_id est interdit.
 * - Super_admin (espace admin) : organization_id est obligatoire.
 */
class StoreAgencyRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Super_admin : toute organisation (existence validée ensuite). Director : la sienne.
        if ($this->user()->isSuperAdmin()) {
            return $this->user()->checkPermissionTo(PermissionName::AgenciesCreate->value);
        }

        $organization = Organization::find($this->targetOrganizationId());

        return $organization !== null && Gate::allows('create', [Agency::class, $organization]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $isAdmin = $this->user()->isSuperAdmin();

        return [
            'organization_id' => $isAdmin
                ? ['required', 'integer', 'exists:organizations,id']
                : ['prohibited'],
            'city_id' => ['required', 'integer', 'exists:cities,id'],
            'name' => [
                'required', 'string', 'max:150',
                Rule::unique('agencies', 'name')->where('organization_id', $this->targetOrganizationId()),
            ],
            'email' => ['nullable', 'string', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'regex:'.Phone::REGEX],
            'address' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'status' => ['sometimes', 'required', Rule::enum(RecordStatus::class)],
        ];
    }

    /**
     * Organisation cible, utilisée pour l'unicité du nom et par le contrôleur.
     */
    public function targetOrganizationId(): ?int
    {
        return $this->user()->isSuperAdmin()
            ? ($this->integer('organization_id') ?: null)
            : $this->user()->scopedOrganizationId();
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['phone' => Phone::normalize($this->phone)]);
    }
}
