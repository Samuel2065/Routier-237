<?php

namespace App\Http\Requests\Employees;

use App\Enums\EmployeeStatus;
use App\Enums\RoleName;
use App\Models\EmployeeProfile;
use App\Support\Phone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * Modification d'un membre du personnel (policy : rôle cible attribuable par l'auteur,
 * même périmètre). Pas de transfert entre agences en V1.
 */
class UpdateEmployeeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->employee());
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $employee = $this->employee();
        $becomesDriver = $this->input('role', $employee->user->primaryRole()?->value) === RoleName::Driver->value;
        $needsLicense = $becomesDriver && $employee->driverProfile === null;

        return [
            'agency_id' => ['prohibited'],
            'role' => ['sometimes', 'required', Rule::in(array_map(fn (RoleName $role) => $role->value, $this->user()->assignableRoles()))],
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'email' => ['sometimes', 'required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($employee->user_id)],
            'phone' => ['sometimes', 'nullable', 'string', 'regex:'.Phone::REGEX, Rule::unique('users', 'phone')->ignore($employee->user_id)],
            // Réinitialisation par le responsable (pas encore de réinitialisation par e-mail).
            'password' => ['sometimes', 'required', 'string', Password::defaults()],
            'employee_number' => [
                'sometimes', 'required', 'string', 'max:50',
                Rule::unique('employee_profiles', 'employee_number')->where('agency_id', $employee->agency_id)->ignore($employee),
            ],
            'hired_at' => ['sometimes', 'nullable', 'date', 'before_or_equal:today'],
            'status' => ['sometimes', 'required', Rule::enum(EmployeeStatus::class)],
            // Pas de « sometimes » ici : le permis doit être exigé même s'il est absent de la requête.
            'license_number' => [
                Rule::requiredIf($needsLicense), Rule::prohibitedIf(! $becomesDriver),
                'string', 'max:50',
                Rule::unique('driver_profiles', 'license_number')->ignore($employee->driverProfile),
            ],
            'license_expires_at' => [
                Rule::requiredIf($needsLicense), Rule::prohibitedIf(! $becomesDriver),
                'date', 'after:today',
            ],
        ];
    }

    public function employee(): EmployeeProfile
    {
        return $this->route('employee');
    }

    protected function prepareForValidation(): void
    {
        EmployeeRules::normalize($this);
    }
}
