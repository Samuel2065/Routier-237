<?php

namespace App\Http\Requests\Employees;

use App\Enums\PermissionName;
use App\Enums\RoleName;
use App\Http\Requests\Concerns\TargetsAgency;
use App\Models\EmployeeProfile;
use App\Support\Phone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * Création d'un membre du personnel. Le rôle doit faire partie des rôles que
 * l'auteur peut attribuer (pas d'escalade de privilèges).
 */
class StoreEmployeeRequest extends FormRequest
{
    use TargetsAgency;

    public function authorize(): bool
    {
        return $this->authorizeForTargetAgency(EmployeeProfile::class, PermissionName::EmployeesCreate->value);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'agency_id' => $this->agencyIdRules(),
            'role' => ['required', Rule::in(array_map(fn (RoleName $role) => $role->value, $this->user()->assignableRoles()))],
            'name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'regex:'.Phone::REGEX, 'unique:users,phone'],
            // Mot de passe initial, communiqué à l'employé par son responsable.
            'password' => ['required', 'string', Password::defaults()],
            'employee_number' => [
                'required', 'string', 'max:50',
                Rule::unique('employee_profiles', 'employee_number')->where('agency_id', $this->targetAgency()?->id),
            ],
            'hired_at' => ['nullable', 'date', 'before_or_equal:today'],
            'license_number' => ['required_if:role,driver', 'prohibited_unless:role,driver', 'nullable', 'string', 'max:50', 'unique:driver_profiles,license_number'],
            'license_expires_at' => ['required_if:role,driver', 'prohibited_unless:role,driver', 'nullable', 'date', 'after:today'],
        ];
    }

    protected function prepareForValidation(): void
    {
        EmployeeRules::normalize($this);
    }
}
