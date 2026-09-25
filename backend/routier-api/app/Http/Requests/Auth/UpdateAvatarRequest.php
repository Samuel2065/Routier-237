<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Photo de profil : image JPEG, PNG ou WebP de 2 Mo au plus (SVG exclu par la règle « image »).
 */
class UpdateAvatarRequest extends FormRequest
{
    public const MAX_KILOBYTES = 2048;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'avatar' => [
                'required',
                'file',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:'.self::MAX_KILOBYTES,
                'dimensions:min_width=64,min_height=64,max_width=5000,max_height=5000',
            ],
        ];
    }
}
