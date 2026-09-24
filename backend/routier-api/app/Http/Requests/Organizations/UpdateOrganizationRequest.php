<?php

namespace App\Http\Requests\Organizations;

use App\Enums\RecordStatus;
use App\Support\Phone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Mise à jour du profil d'une organisation. Seul le super_admin peut changer
 * son statut (activer/suspendre) ; le director ne modifie que le profil.
 */
class UpdateOrganizationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('update', $this->route('organization'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $organization = $this->route('organization');

        return [
            'name' => [
                'sometimes', 'required', 'string', 'max:150',
                Rule::unique('organizations', 'name')->ignore($organization),
            ],
            'email' => ['sometimes', 'nullable', 'string', 'email', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'regex:'.Phone::REGEX],
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'status' => [
                Rule::prohibitedIf(! $this->user()->isSuperAdmin()),
                'sometimes', 'required', Rule::enum(RecordStatus::class),
            ],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('phone')) {
            $this->merge(['phone' => Phone::normalize($this->phone)]);
        }
    }
}
