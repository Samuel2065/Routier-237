import { Loader2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useCancelReservation } from '@/features/reservations/queries'
import { getErrorMessage } from '@/lib/api-error'
import type { Reservation } from '@/types/api'

/**
 * Annulation confirmée par une boîte de dialogue (opération sensible).
 */
export function CancelReservationButton({ reservation }: { reservation: Reservation }) {
  const cancel = useCancelReservation()
  const paid = reservation.status === 'confirmed'

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={cancel.isPending}>
          {cancel.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <XCircle aria-hidden="true" />}
          Annuler la réservation
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Annuler la réservation {reservation.reference} ?</AlertDialogTitle>
          <AlertDialogDescription>
            Les places seront libérées et cette action est définitive.
            {paid && " Le remboursement éventuel sera traité par l'agence."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Garder ma réservation</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              cancel.mutate(reservation.id, {
                onSuccess: () => toast.success('Réservation annulée.'),
                onError: (error) => toast.error(getErrorMessage(error)),
              })
            }
          >
            Oui, annuler
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
