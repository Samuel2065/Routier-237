<?php

namespace App\Http\Requests\Agencies;

use App\Enums\RecordStatus;
use App\Models\Agency;
use App\Support\Phone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Modification complète d'une agence (director de l'organisation ou super_admin).
 * L'organisation propriétaire ne peut jamais être changée.
 */
class UpdateAgencyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('update', $this->route('agency'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var Agency $agency */
        $agency = $this->route('agency');

        return [
            'organization_id' => ['prohibited'],
            'city_id' => ['sometimes', 'required', 'integer', 'exists:cities,id'],
            'name' => [
                'sometimes', 'required', 'string', 'max:150',
                Rule::unique('agencies', 'name')->where('organization_id', $agency->organization_id)->ignore($agency),
            ],
            'email' => ['sometimes', 'nullable', 'string', 'email', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'regex:'.Phone::REGEX],
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'status' => ['sometimes', 'required', Rule::enum(RecordStatus::class)],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('phone')) {
            $this->merge(['phone' => Phone::normalize($this->phone)]);
        }
    }
}
