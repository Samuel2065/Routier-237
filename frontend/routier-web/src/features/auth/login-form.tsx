import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, LogIn } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { FormField } from '@/components/common/form-field'
import { fieldAria } from '@/lib/field-aria'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCustomerLogin } from '@/features/auth/queries'
import { loginSchema, type LoginValues } from '@/features/auth/schemas'
import { applyServerErrors, getErrorMessage, getFieldErrors } from '@/lib/api-error'

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const login = useCustomerLogin()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, {
      onSuccess,
      onError: (error) => {
        applyServerErrors(error, setError)
      },
    })
  })

  // Les erreurs de champ du serveur (ex. identifiants refusés) s'affichent sous le champ ;
  // les autres (réseau, trop de tentatives) en bandeau.
  const generalError = login.isError && Object.keys(getFieldErrors(login.error)).length === 0 ? getErrorMessage(login.error) : null

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4" aria-label="Connexion client">
      {generalError && (
        <Alert variant="destructive">
          <AlertDescription>{generalError}</AlertDescription>
        </Alert>
      )}

      <FormField id="email" label="Adresse e-mail" error={errors.email?.message}>
        <Input type="email" autoComplete="email" {...fieldAria('email', errors.email?.message)} {...register('email')} />
      </FormField>

      <FormField id="password" label="Mot de passe" error={errors.password?.message}>
        <Input type="password" autoComplete="current-password" {...fieldAria('password', errors.password?.message)} {...register('password')} />
      </FormField>

      <Button type="submit" size="lg" className="h-9" disabled={login.isPending}>
        {login.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogIn aria-hidden="true" />}
        Se connecter
      </Button>
    </form>
  )
}
