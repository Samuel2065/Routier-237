import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, KeyRound, Loader2, MailCheck } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router'
import { requestPasswordReset, resetPassword } from '@/api/auth'
import { FormField } from '@/components/common/form-field'
import { Container } from '@/components/layout/container'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  type ForgotPasswordValues,
  type ResetPasswordValues,
} from '@/features/auth/schemas'
import { applyServerErrors, getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { fieldAria } from '@/lib/field-aria'
import type { Space } from '@/types/api'

/** Page de connexion de chaque espace. */
const LOGIN_PATHS: Record<Space, string> = { customer: '/login', agency: '/agency/login', admin: '/admin/login' }

function spaceFrom(value: string | null): Space {
  return value === 'agency' || value === 'admin' ? value : 'customer'
}

/**
 * « Mot de passe oublié ? » (/forgot-password?space=…) : envoi d'un lien de réinitialisation.
 * Le message est le même que le compte existe ou non (aucune information divulguée).
 */
export function ForgotPasswordPage() {
  const [searchParams] = useSearchParams()
  const loginPath = LOGIN_PATHS[spaceFrom(searchParams.get('space'))]
  const request = useMutation({ mutationFn: (values: ForgotPasswordValues) => requestPasswordReset(values.email) })
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } })

  const onSubmit = handleSubmit((values) => request.mutate(values, { onError: (error) => applyServerErrors(error, setError) }))
  const generalError = request.isError && Object.keys(getFieldErrors(request.error)).length === 0 ? getErrorMessage(request.error) : null

  return (
    <Container className="max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <KeyRound className="size-5 text-primary" aria-hidden="true" />
            Mot de passe oublié
          </CardTitle>
          <CardDescription>Indiquez l'adresse e-mail de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {request.isSuccess ? (
            <Alert>
              <MailCheck aria-hidden="true" />
              <AlertDescription>
                {request.data} Le lien est valable 60 minutes. Pensez à vérifier vos courriers indésirables.
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={onSubmit} noValidate className="grid gap-4" aria-label="Demander un lien de réinitialisation">
              {generalError && (
                <Alert variant="destructive">
                  <AlertDescription>{generalError}</AlertDescription>
                </Alert>
              )}
              <FormField id="email" label="Adresse e-mail" error={errors.email?.message}>
                <Input type="email" autoComplete="email" {...fieldAria('email', errors.email?.message)} {...register('email')} />
              </FormField>
              <Button type="submit" size="lg" className="h-9" disabled={request.isPending}>
                {request.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                Envoyer le lien
              </Button>
            </form>
          )}
          <p className="text-center text-sm">
            <Link to={loginPath} className="font-medium text-primary underline-offset-4 hover:underline">
              Retour à la connexion
            </Link>
          </p>
        </CardContent>
      </Card>
    </Container>
  )
}

/**
 * Nouveau mot de passe (/reset-password?token=…&email=…), depuis le lien reçu par e-mail.
 * Après le changement, toutes les sessions du compte sont fermées par l'API.
 */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const email = searchParams.get('email') ?? ''
  const reset = useMutation({ mutationFn: (values: ResetPasswordValues) => resetPassword({ token, email, ...values }) })
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: '', password_confirmation: '' } })

  const onSubmit = handleSubmit((values) => reset.mutate(values, { onError: (error) => applyServerErrors(error, setError) }))
  // Lien invalide ou expiré : l'API répond sur le champ e-mail, absent du formulaire.
  const fieldErrors = reset.isError ? getFieldErrors(reset.error) : {}
  const linkError = fieldErrors.email ?? fieldErrors.token
  const generalError = reset.isError && !linkError && Object.keys(fieldErrors).length === 0 ? getErrorMessage(reset.error) : null

  return (
    <Container className="max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <KeyRound className="size-5 text-primary" aria-hidden="true" />
            Nouveau mot de passe
          </CardTitle>
          <CardDescription>{email ? `Compte : ${email}` : 'Choisissez un nouveau mot de passe.'}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!token || !email ? (
            <Alert variant="destructive">
              <AlertDescription>
                Ce lien est incomplet. Ouvrez le lien reçu par e-mail, ou{' '}
                <Link to="/forgot-password" className="font-medium underline underline-offset-4">
                  demandez-en un nouveau
                </Link>
                .
              </AlertDescription>
            </Alert>
          ) : reset.isSuccess ? (
            <div className="grid gap-4">
              <Alert>
                <CheckCircle2 aria-hidden="true" />
                <AlertDescription>{reset.data.message} Par sécurité, toutes vos sessions ouvertes ont été fermées.</AlertDescription>
              </Alert>
              <Button asChild size="lg" className="h-9">
                <Link to={LOGIN_PATHS[reset.data.space]}>Se connecter</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="grid gap-4" aria-label="Choisir un nouveau mot de passe">
              {(linkError || generalError) && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {linkError ?? generalError}{' '}
                    {linkError && (
                      <Link to="/forgot-password" className="font-medium underline underline-offset-4">
                        Demander un nouveau lien
                      </Link>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              <FormField id="password" label="Nouveau mot de passe" error={errors.password?.message} hint="8 caractères au moins, avec des lettres et des chiffres.">
                <Input type="password" autoComplete="new-password" {...fieldAria('password', errors.password?.message)} {...register('password')} />
              </FormField>
              <FormField id="password_confirmation" label="Confirmez le mot de passe" error={errors.password_confirmation?.message}>
                <Input
                  type="password"
                  autoComplete="new-password"
                  {...fieldAria('password_confirmation', errors.password_confirmation?.message)}
                  {...register('password_confirmation')}
                />
              </FormField>
              <Button type="submit" size="lg" className="h-9" disabled={reset.isPending}>
                {reset.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                Enregistrer le mot de passe
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </Container>
  )
}
