import { ShieldX } from 'lucide-react'
import { Link, Outlet } from 'react-router'
import { EmptyState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { useCan } from '@/features/agency/session'

/**
 * Garde d'une section de l'espace agence : sans l'une des permissions requises, la page
 * n'est pas chargée (aucun appel d'API voué au refus) et un message clair s'affiche.
 * Confort d'affichage : l'API reste seule juge et refuserait de toute façon (403).
 */
export function RequireAgencyPermission({ anyOf }: { anyOf: string[] }) {
  const can = useCan()

  if (anyOf.length > 0 && !anyOf.some(can)) {
    return <AccessDenied />
  }

  return <Outlet />
}

export function AccessDenied() {
  return (
    <EmptyState
      icon={<ShieldX className="size-8 text-muted-foreground" aria-hidden="true" />}
      title="Accès non autorisé"
      description="Votre rôle ne donne pas accès à cette section. Contactez le responsable de votre agence si nécessaire."
      action={
        <Button asChild>
          <Link to="/agency/dashboard">Retour au tableau de bord</Link>
        </Button>
      }
    />
  )
}
