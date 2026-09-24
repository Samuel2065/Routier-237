import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, Loader2, LogIn } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { FormField } from '@/components/common/form-field'
import { Logo } from '@/components/layout/public-layout'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { loginSchema, type LoginValues } from '@/features/auth/schemas'
import { useAgencyLogin } from '@/features/agency/session'
import { applyServerErrors, getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { fieldAria } from '@/lib/field-aria'
import { safeRedirect } from '@/lib/validation'
import { useSession } from '@/store/auth-store'

/**
 * Connexion du personnel (/agency/login), accessible directement sans passer
 * par l'espace public (§4.2). Seuls les rôles internes sont acceptés par l'API.
 */
export function AgencyLoginPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const session = useSession('agency')
  const login = useAgencyLogin()
  const redirect = safeRedirect(searchParams.get('redirect'), '/agency/dashboard')
  const target = redirect.startsWith('/agency') ? redirect : '/agency/dashboard'

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })

  if (session) return <Navigate to={target} replace />

  const onSubmit = handleSubmit((values) =>
    login.mutate(values, {
      onSuccess: () => navigate(target, { replace: true }),
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
            <Building2 className="size-5 text-primary" aria-hidden="true" />
            Espace agence
          </CardTitle>
          <CardDescription>Connexion réservée au personnel des agences.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate className="grid gap-4" aria-label="Connexion à l'espace agence">
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
