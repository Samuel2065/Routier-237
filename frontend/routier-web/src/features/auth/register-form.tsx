import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, UserPlus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { FormField } from '@/components/common/form-field'
import { fieldAria } from '@/lib/field-aria'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCustomerRegister } from '@/features/auth/queries'
import { registerSchema, type RegisterInput, type RegisterValues } from '@/features/auth/schemas'
import { applyServerErrors, getErrorMessage, getFieldErrors } from '@/lib/api-error'

export function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const signUp = useCustomerRegister()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterInput, unknown, RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', phone: '', password: '', password_confirmation: '' },
  })

  const onSubmit = handleSubmit((values) => {
    signUp.mutate(values, {
      onSuccess,
      onError: (error) => {
        applyServerErrors(error, setError)
      },
    })
  })

  const generalError = signUp.isError && Object.keys(getFieldErrors(signUp.error)).length === 0 ? getErrorMessage(signUp.error) : null

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4" aria-label="Créer un compte client">
      {generalError && (
        <Alert variant="destructive">
          <AlertDescription>{generalError}</AlertDescription>
        </Alert>
      )}

      <FormField id="name" label="Nom complet" required error={errors.name?.message}>
        <Input autoComplete="name" {...fieldAria('name', errors.name?.message)} {...register('name')} />
      </FormField>

      <FormField id="email" label="Adresse e-mail" required error={errors.email?.message}>
        <Input type="email" autoComplete="email" {...fieldAria('email', errors.email?.message)} {...register('email')} />
      </FormField>

      <FormField id="phone" label="Téléphone" hint="Facultatif — utile à l'agence pour vous joindre." error={errors.phone?.message}>
        <Input
          type="tel"
          autoComplete="tel"
          placeholder="699 12 34 56"
          {...fieldAria('phone', errors.phone?.message, "Facultatif — utile à l'agence pour vous joindre.")}
          {...register('phone')}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="password" label="Mot de passe" required hint="8 caractères minimum, avec lettres et chiffres." error={errors.password?.message}>
          <Input
            type="password"
            autoComplete="new-password"
            {...fieldAria('password', errors.password?.message, '8 caractères minimum, avec lettres et chiffres.')}
            {...register('password')}
          />
        </FormField>

        <FormField id="password_confirmation" label="Confirmation" required error={errors.password_confirmation?.message}>
          <Input
            type="password"
            autoComplete="new-password"
            {...fieldAria('password_confirmation', errors.password_confirmation?.message)}
            {...register('password_confirmation')}
          />
        </FormField>
      </div>

      <Button type="submit" size="lg" className="h-9" disabled={signUp.isPending}>
        {signUp.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
        Créer mon compte
      </Button>
    </form>
  )
}
