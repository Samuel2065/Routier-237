<?php

namespace App\Actions\Employees;

use App\Enums\EmployeeStatus;
use App\Enums\RecordStatus;
use App\Enums\RoleName;
use App\Enums\UserStatus;
use App\Models\Agency;
use App\Models\EmployeeProfile;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Création d'un membre du personnel d'agence : compte utilisateur + profil employé
 * (+ profil conducteur pour le rôle driver), en une transaction.
 *
 * Le rôle a déjà été contrôlé (rôles attribuables par l'auteur) par la Form Request.
 */
class CreateEmployee
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(Agency $agency, RoleName $role, array $data): EmployeeProfile
    {
        return DB::transaction(function () use ($agency, $role, $data) {
            $user = new User([
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
                'password' => $data['password'],
            ]);
            $user->status = UserStatus::Active;
            $user->save();
            $user->assignRole($role->value);

            $employee = new EmployeeProfile([
                'employee_number' => $data['employee_number'],
                'hired_at' => $data['hired_at'] ?? null,
            ]);
            $employee->status = EmployeeStatus::Active;
            $employee->user()->associate($user);
            $employee->agency()->associate($agency);
            $employee->save();

            if ($role === RoleName::Driver) {
                $employee->driverProfile()->create([
                    'license_number' => $data['license_number'],
                    'license_expires_at' => $data['license_expires_at'],
                    'status' => RecordStatus::Active,
                ]);
            }

            return $employee;
        });
    }
}
