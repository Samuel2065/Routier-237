import { zodResolver } from '@hookform/resolvers/zod'
import { CreditCard, Loader2, Smartphone, Wallet } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormField } from '@/components/common/form-field'
import { fieldAria } from '@/lib/field-aria'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useCreatePayment } from '@/features/payments/queries'
import { applyServerErrors, getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { formatPrice } from '@/lib/format'
import { PAYMENT_METHOD_LABELS } from '@/lib/labels'
import { isValidPhone, normalizePhone } from '@/lib/validation'
import type { PaymentMethod } from '@/types/api'

const METHODS: { value: PaymentMethod; icon: typeof Smartphone; hint: string }[] = [
  { value: 'orange_money', icon: Smartphone, hint: 'Validation sur votre téléphone Orange' },
  { value: 'mtn_momo', icon: Wallet, hint: 'Validation sur votre téléphone MTN' },
  { value: 'card', icon: CreditCard, hint: 'Visa ou équivalent' },
]

const paymentSchema = z
  .object({
    method: z.enum(['orange_money', 'mtn_momo', 'card'], { error: 'Choisissez un moyen de paiement.' }),
    phone: z.string().trim(),
  })
  .refine((values) => values.method === 'card' || isValidPhone(values.phone), {
    path: ['phone'],
    error: 'Indiquez le numéro mobile money à débiter (ex. 699 12 34 56).',
  })

type PaymentFormValues = z.infer<typeof paymentSchema>

/**
 * Choix du moyen de paiement (§10) : Orange Money, MTN MoMo ou carte.
 */
export function PaymentForm({ reservationId, amount, defaultPhone }: { reservationId: number; amount: number; defaultPhone?: string | null }) {
  const createPayment = useCreatePayment(reservationId)
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { method: 'orange_money', phone: defaultPhone ?? '' },
  })
  const method = useWatch({ control, name: 'method' })
  const mobileMoney = method !== 'card'

  const onSubmit = handleSubmit((values) => {
    createPayment.mutate(
      { method: values.method, phone: values.method === 'card' ? null : normalizePhone(values.phone) },
      {
        onSuccess: ({ meta }) => toast.info(meta.instructions ?? 'Paiement en cours de traitement.'),
        onError: (error) => {
          applyServerErrors(error, setError)
        },
      },
    )
  })

  const serverError =
    createPayment.isError && Object.keys(getFieldErrors(createPayment.error)).length === 0 ? getErrorMessage(createPayment.error) : null

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4" aria-label="Paiement de la réservation">
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Moyen de paiement</legend>
        <Controller
          control={control}
          name="method"
          render={({ field }) => (
            <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-2 sm:grid-cols-3">
              {METHODS.map(({ value, icon: Icon, hint }) => (
                <Label
                  key={value}
                  htmlFor={`method-${value}`}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-secondary"
                >
                  <RadioGroupItem id={`method-${value}`} value={value} className="mt-0.5" />
                  <span className="grid gap-0.5">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Icon className="size-4" aria-hidden="true" />
                      {PAYMENT_METHOD_LABELS[value]}
                    </span>
                    <span className="text-xs text-muted-foreground">{hint}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          )}
        />
        {errors.method && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {errors.method.message}
          </p>
        )}
      </fieldset>

      {mobileMoney && (
        <FormField id="payment-phone" label="Numéro à débiter" required error={errors.phone?.message}>
          <Input type="tel" autoComplete="tel" placeholder="699 12 34 56" {...fieldAria('payment-phone', errors.phone?.message)} {...register('phone')} />
        </FormField>
      )}

      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" size="lg" className="h-10" disabled={createPayment.isPending}>
        {createPayment.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
        Payer {formatPrice(amount)}
      </Button>
    </form>
  )
}
