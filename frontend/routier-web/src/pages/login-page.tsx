import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { Container } from '@/components/layout/container'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoginForm } from '@/features/auth/login-form'
import { safeRedirect } from '@/lib/validation'
import { useSession } from '@/store/auth-store'

/**
 * Connexion client (/login). Le personnel d'agence utilise son propre espace.
 */
export function LoginPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const session = useSession('customer')
  const redirect = safeRedirect(searchParams.get('redirect'))

  if (session) return <Navigate to={redirect} replace />

  return (
    <Container className="max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Connexion</CardTitle>
          <CardDescription>Accédez à vos réservations et poursuivez votre réservation.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <LoginForm onSuccess={() => navigate(redirect, { replace: true })} />
          <p className="text-center text-sm text-muted-foreground">
            Pas encore de compte ?{' '}
            <Link to={`/register?redirect=${encodeURIComponent(redirect)}`} className="font-medium text-primary underline-offset-4 hover:underline">
              Créer un compte
            </Link>
          </p>
        </CardContent>
      </Card>
    </Container>
  )
}
