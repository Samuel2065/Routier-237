<?php

namespace App\Http\Requests\Agencies;

use App\Support\Phone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

/**
 * Paramètres de l'agence modifiables par son responsable (/agency/settings) :
 * coordonnées et présentation publique. Nom, ville et statut restent du ressort
 * du director (tout autre champ envoyé est ignoré).
 */
class UpdateAgencySettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('updateSettings', $this->route('agency'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'email' => ['sometimes', 'nullable', 'string', 'email', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'regex:'.Phone::REGEX],
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('phone')) {
            $this->merge(['phone' => Phone::normalize($this->phone)]);
        }
    }
}
