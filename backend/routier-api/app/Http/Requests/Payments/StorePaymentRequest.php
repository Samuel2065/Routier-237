<?php

namespace App\Http\Requests\Payments;

use App\Enums\PaymentMethod;
use App\Models\Payment;
use App\Support\Phone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Paiement d'une réservation par son titulaire. Le numéro débité est obligatoire
 * pour le mobile money (Orange Money, MTN MoMo), inutile pour la carte.
 */
class StorePaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', [Payment::class, $this->route('reservation')]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'method' => ['required', Rule::enum(PaymentMethod::class)],
            'phone' => [
                Rule::requiredIf(fn () => $this->isMobileMoney()),
                Rule::prohibitedIf(fn () => $this->input('method') === PaymentMethod::Card->value),
                'nullable', 'string', 'regex:'.Phone::REGEX,
            ],
        ];
    }

    public function paymentMethod(): PaymentMethod
    {
        return PaymentMethod::from($this->validated('method'));
    }

    private function isMobileMoney(): bool
    {
        return in_array($this->input('method'), [PaymentMethod::OrangeMoney->value, PaymentMethod::MtnMomo->value], true);
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('phone')) {
            $this->merge(['phone' => Phone::normalize($this->input('phone'))]);
        }
    }
}
