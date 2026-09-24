import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Container } from '@/components/layout/container'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RegisterForm } from '@/features/auth/register-form'
import { safeRedirect } from '@/lib/validation'
import { useSession } from '@/store/auth-store'

/**
 * Inscription publique (/register) : comptes clients uniquement (§6.1).
 */
export function RegisterPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const session = useSession('customer')
  const redirect = safeRedirect(searchParams.get('redirect'))

  if (session) return <Navigate to={redirect} replace />

  return (
    <Container className="max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Créer un compte voyageur</CardTitle>
          <CardDescription>Gratuit, il vous permet de réserver et de suivre vos voyages.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <RegisterForm
            onSuccess={() => {
              toast.success('Bienvenue sur Routier+237 !')
              navigate(redirect, { replace: true })
            }}
          />
          <p className="text-center text-sm text-muted-foreground">
            Déjà inscrit ?{' '}
            <Link to={`/login?redirect=${encodeURIComponent(redirect)}`} className="font-medium text-primary underline-offset-4 hover:underline">
              Se connecter
            </Link>
          </p>
        </CardContent>
      </Card>
    </Container>
  )
}
