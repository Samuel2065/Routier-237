<?php

namespace App\Http\Requests\Cities;

use App\Models\City;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class SaveCityRequest extends FormRequest
{
    public function authorize(): bool
    {
        $city = $this->route('city');

        return $city ? Gate::allows('update', $city) : Gate::allows('create', City::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => [
                'required', 'string', 'max:100',
                Rule::unique('cities', 'name')->ignore($this->route('city')),
            ],
        ];
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->name)) {
            $this->merge(['name' => trim($this->name)]);
        }
    }
}
