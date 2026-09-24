<?php

namespace App\Http\Controllers\Api\V1\Agency;

use App\Actions\Employees\CreateEmployee;
use App\Actions\Employees\UpdateEmployee;
use App\Enums\EmployeeStatus;
use App\Enums\RoleName;
use App\Http\Controllers\Controller;
use App\Http\Requests\Employees\StoreEmployeeRequest;
use App\Http\Requests\Employees\UpdateEmployeeRequest;
use App\Http\Resources\EmployeeResource;
use App\Models\EmployeeProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Personnel des agences (/agency/employees), conducteurs compris (?role=driver).
 * Pas de suppression : un employé qui part passe au statut « terminated ».
 */
class EmployeeController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', EmployeeProfile::class);

        $request->validate([
            'agency_id' => ['sometimes', 'integer'],
            'role' => ['sometimes', Rule::in(array_map(fn (RoleName $role) => $role->value, RoleName::internal()))],
            'status' => ['sometimes', Rule::enum(EmployeeStatus::class)],
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
        ]);

        $search = trim((string) $request->query('search', ''));
        $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search);

        $employees = EmployeeProfile::query()
            ->accessibleBy($request->user())
            ->with(['user.roles', 'agency', 'driverProfile'])
            ->when($request->filled('agency_id'), fn ($query) => $query->where('agency_id', $request->integer('agency_id')))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->query('status')))
            ->when($request->filled('role'), fn ($query) => $query->whereHas('user', fn ($user) => $user->role($request->query('role'))))
            ->when($search !== '', fn ($query) => $query->where(function ($query) use ($escaped) {
                $query->where('employee_number', 'like', "%{$escaped}%")
                    ->orWhereHas('user', fn ($user) => $user
                        ->where('name', 'like', "%{$escaped}%")
                        ->orWhere('email', 'like', "%{$escaped}%"));
            }))
            ->orderBy('employee_number');

        return EmployeeResource::collection($employees->paginate($this->perPage($request))->withQueryString());
    }

    public function store(StoreEmployeeRequest $request, CreateEmployee $createEmployee): JsonResponse
    {
        $employee = $createEmployee->handle(
            $request->targetAgency(),
            RoleName::from($request->validated('role')),
            $request->validated(),
        );

        return (new EmployeeResource($this->loadDetails($employee)))->response()->setStatusCode(201);
    }

    public function show(EmployeeProfile $employee): EmployeeResource
    {
        Gate::authorize('view', $employee);

        return new EmployeeResource($this->loadDetails($employee));
    }

    public function update(UpdateEmployeeRequest $request, EmployeeProfile $employee, UpdateEmployee $updateEmployee): EmployeeResource
    {
        $employee = $updateEmployee->handle($employee, $request->validated());

        return new EmployeeResource($this->loadDetails($employee->fresh()));
    }

    private function loadDetails(EmployeeProfile $employee): EmployeeProfile
    {
        return $employee->load(['user.roles', 'agency', 'driverProfile']);
    }
}
