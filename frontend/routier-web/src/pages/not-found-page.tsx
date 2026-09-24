import { MapPinOff } from 'lucide-react'
import { Link, isRouteErrorResponse, useRouteError } from 'react-router'
import { Container } from '@/components/layout/container'
import { EmptyState } from '@/components/common/states'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <Container>
      <EmptyState
        icon={<MapPinOff className="size-8 text-muted-foreground" aria-hidden="true" />}
        title="Page introuvable"
        description="L'adresse demandée n'existe pas ou n'est plus disponible."
        action={
          <Button asChild>
            <Link to="/">Retour à l'accueil</Link>
          </Button>
        }
      />
    </Container>
  )
}

/**
 * Erreur inattendue lors du rendu d'une page : message sobre, sans détail technique.
 */
export function RouteErrorPage() {
  const error = useRouteError()

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundPage />
  }

  return (
    <Container>
      <EmptyState
        title="Une erreur inattendue est survenue"
        description="Rechargez la page. Si le problème persiste, réessayez plus tard."
        action={
          <Button onClick={() => window.location.assign('/')}>Retour à l'accueil</Button>
        }
      />
    </Container>
  )
}
