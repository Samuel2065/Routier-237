<?php

namespace App\Http\Requests\Employees;

use App\Support\Phone;
use Illuminate\Foundation\Http\FormRequest;

final class EmployeeRules
{
    /**
     * E-mail en minuscules, téléphone sans séparateurs, numéros en majuscules.
     */
    public static function normalize(FormRequest $request): void
    {
        $changes = [];

        if (is_string($request->input('email'))) {
            $changes['email'] = mb_strtolower(trim($request->input('email')));
        }

        if ($request->has('phone')) {
            $changes['phone'] = Phone::normalize($request->input('phone'));
        }

        foreach (['employee_number', 'license_number'] as $field) {
            if (is_string($request->input($field))) {
                $changes[$field] = mb_strtoupper(trim($request->input($field)));
            }
        }

        $request->merge($changes);
    }
}
