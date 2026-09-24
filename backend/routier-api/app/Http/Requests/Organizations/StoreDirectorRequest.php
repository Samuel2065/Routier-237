<?php

namespace App\Http\Requests\Organizations;

use App\Support\Phone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rules\Password;

class StoreDirectorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('createDirector', $this->route('organization'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'regex:'.Phone::REGEX, 'unique:users,phone'],
            // Mot de passe initial, transmis au directeur hors plateforme.
            'password' => ['required', 'string', Password::defaults()],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'email' => is_string($this->email) ? mb_strtolower(trim($this->email)) : $this->email,
            'phone' => Phone::normalize($this->phone),
        ]);
    }
}
