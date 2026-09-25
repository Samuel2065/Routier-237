<?php

namespace Tests\Unit;

use App\Enums\PermissionName;
use App\Enums\RoleName;
use PHPUnit\Framework\TestCase;

/**
 * Matrice rôles → permissions (§6) : moindre privilège et absence d'escalade.
 */
class RolePermissionMatrixTest extends TestCase
{
    public function test_a_customer_has_no_management_permission(): void
    {
        $this->assertSame([], RoleName::Customer->permissions());
        $this->assertSame([], RoleName::Customer->assignableRoles());
    }

    public function test_only_the_platform_manages_organizations_and_cities(): void
    {
        foreach (RoleName::cases() as $role) {
            $permissions = $role->permissions();

            $this->assertSame($role === RoleName::SuperAdmin, in_array(PermissionName::OrganizationsCreate, $permissions, true), $role->value);
            $this->assertSame($role === RoleName::SuperAdmin, in_array(PermissionName::CitiesManage, $permissions, true), $role->value);
        }
    }

    public function test_refunds_are_limited_to_finance_roles(): void
    {
        $refunders = array_values(array_filter(
            RoleName::cases(),
            fn (RoleName $role) => in_array(PermissionName::PaymentsRefund, $role->permissions(), true),
        ));

        $this->assertEqualsCanonicalizing([RoleName::SuperAdmin, RoleName::Accountant], $refunders);
    }

    public function test_a_driver_only_reads(): void
    {
        $this->assertEqualsCanonicalizing(
            [PermissionName::DashboardView, PermissionName::TripsView, PermissionName::VehiclesView],
            RoleName::Driver->permissions(),
        );
    }

    public function test_no_role_can_assign_its_own_level_or_above(): void
    {
        $rank = [
            RoleName::SuperAdmin->value => 4,
            RoleName::Director->value => 3,
            RoleName::AgencyManager->value => 2,
            RoleName::CounterClerk->value => 1,
            RoleName::Accountant->value => 1,
            RoleName::Driver->value => 1,
            RoleName::Customer->value => 0,
        ];

        foreach (RoleName::cases() as $role) {
            foreach ($role->assignableRoles() as $assignable) {
                $this->assertLessThan($rank[$role->value], $rank[$assignable->value], "{$role->value} → {$assignable->value}");
                $this->assertNotSame(RoleName::SuperAdmin, $assignable);
                $this->assertNotSame(RoleName::Customer, $assignable);
            }
        }
    }
}
