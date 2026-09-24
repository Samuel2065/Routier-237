import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'

export interface ConfirmRequest {
  title: string
  description: ReactNode
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void
}

/**
 * Confirmation des opérations sensibles (§18.2) : annuler, rembourser, supprimer…
 */
export function ConfirmDialog({
  request,
  pending = false,
  onClose,
}: {
  request: ConfirmRequest | null
  pending?: boolean
  onClose: () => void
}) {
  return (
    <AlertDialog open={request !== null} onOpenChange={(open) => !open && !pending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          <AlertDialogDescription>{request?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className={request?.destructive ? buttonVariants({ variant: 'destructive' }) : undefined}
            onClick={(event) => {
              // La boîte reste ouverte pendant l'appel ; l'appelant la ferme à la fin.
              event.preventDefault()
              request?.onConfirm()
            }}
          >
            {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {request?.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
