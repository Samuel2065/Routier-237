<?php

namespace App\Http\Requests\Organizations;

use App\Models\Organization;
use App\Support\Phone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

/**
 * Autorisation : OrganizationPolicy::create (super_admin).
 */
class StoreOrganizationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('create', Organization::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150', 'unique:organizations,name'],
            'email' => ['nullable', 'string', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'regex:'.Phone::REGEX],
            'address' => ['nullable', 'string', 'max:255'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['phone' => Phone::normalize($this->phone)]);
    }
}
