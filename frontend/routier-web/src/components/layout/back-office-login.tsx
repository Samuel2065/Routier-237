import { zodResolver } from '@hookform/resolvers/zod'
import type { UseMutationResult } from '@tanstack/react-query'
import { Loader2, LogIn, type LucideIcon } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { FormField } from '@/components/common/form-field'
import { Logo } from '@/components/layout/public-layout'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { loginSchema, type LoginValues } from '@/features/auth/schemas'
import { applyServerErrors, getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { fieldAria } from '@/lib/field-aria'
import type { AuthPayload } from '@/types/api'

interface BackOfficeLoginProps {
  title: string
  description: string
  icon: LucideIcon
  login: UseMutationResult<AuthPayload, Error, LoginValues>
  onSuccess: () => void
}

/**
 * Page de connexion des espaces privés (agence, administration), hors espace public.
 */
export function BackOfficeLogin({ title, description, icon: Icon, login, onSuccess }: BackOfficeLoginProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })

  const onSubmit = handleSubmit((values) =>
    login.mutate(values, {
      onSuccess,
      onError: (error) => {
        applyServerErrors(error, setError)
      },
    }),
  )

  const generalError = login.isError && Object.keys(getFieldErrors(login.error)).length === 0 ? getErrorMessage(login.error) : null

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-4">
      <Logo />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Icon className="size-5 text-primary" aria-hidden="true" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate className="grid gap-4" aria-label={`Connexion — ${title}`}>
            {generalError && (
              <Alert variant="destructive">
                <AlertDescription>{generalError}</AlertDescription>
              </Alert>
            )}
            <FormField id="email" label="Adresse e-mail" error={errors.email?.message}>
              <Input type="email" autoComplete="username" {...fieldAria('email', errors.email?.message)} {...register('email')} />
            </FormField>
            <FormField id="password" label="Mot de passe" error={errors.password?.message}>
              <Input type="password" autoComplete="current-password" {...fieldAria('password', errors.password?.message)} {...register('password')} />
            </FormField>
            <Button type="submit" size="lg" className="h-9" disabled={login.isPending}>
              {login.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogIn aria-hidden="true" />}
              Se connecter
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
