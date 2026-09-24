<?php

namespace App\Actions\Employees;

use App\Enums\EmployeeStatus;
use App\Enums\RecordStatus;
use App\Enums\RoleName;
use App\Models\EmployeeProfile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

/**
 * Modification d'un membre du personnel : identité, profil employé, rôle et permis.
 *
 * - Passage au rôle driver : le profil conducteur est créé (ou réactivé).
 * - Sortie du rôle driver : le profil conducteur est désactivé, pas supprimé.
 * - Changement de mot de passe, suspension ou départ : les jetons sont révoqués.
 */
class UpdateEmployee
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(EmployeeProfile $employee, array $data): EmployeeProfile
    {
        return DB::transaction(function () use ($employee, $data) {
            $user = $employee->user;

            $user->fill(Arr::only($data, ['name', 'email', 'phone', 'password']));
            $passwordChanged = $user->isDirty('password');
            $user->save();

            $employee->fill(Arr::only($data, ['employee_number', 'hired_at', 'status']));
            $employee->save();

            $role = isset($data['role']) ? RoleName::from($data['role']) : $user->primaryRole();

            if (isset($data['role']) && $role !== $user->primaryRole()) {
                $user->syncRoles([$role->value]);
            }

            $this->syncDriverProfile($employee, $role, $data);

            if ($passwordChanged || $employee->status !== EmployeeStatus::Active) {
                $user->tokens()->delete();
            }

            return $employee;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function syncDriverProfile(EmployeeProfile $employee, ?RoleName $role, array $data): void
    {
        $driver = $employee->driverProfile;
        $license = Arr::only($data, ['license_number', 'license_expires_at']);

        if ($role === RoleName::Driver) {
            if ($driver === null) {
                $employee->driverProfile()->create($license + ['status' => RecordStatus::Active]);
            } else {
                $driver->update($license + ['status' => RecordStatus::Active]);
            }

            return;
        }

        $driver?->update(['status' => RecordStatus::Inactive]);
    }
}
