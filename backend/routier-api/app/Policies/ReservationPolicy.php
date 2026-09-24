<?php

namespace App\Policies;

use App\Enums\PermissionName as P;
use App\Models\Reservation;
use App\Models\User;

/**
 * Un client n'accède qu'à ses propres réservations (critère A9) ;
 * le personnel qu'aux réservations des trajets de ses agences (critère A10).
 */
class ReservationPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isCustomer() || $user->checkPermissionTo(P::ReservationsView->value);
    }

    public function view(User $user, Reservation $reservation): bool
    {
        return $this->ownedBy($user, $reservation)
            || $this->staffAllowed($user, P::ReservationsView, $reservation);
    }

    /**
     * Seul un client réserve (réservation rattachée au compte qui la crée).
     */
    public function create(User $user): bool
    {
        return $user->isCustomer();
    }

    /**
     * Les règles d'état (délais, statuts annulables) sont appliquées par le service du module 7.
     */
    public function cancel(User $user, Reservation $reservation): bool
    {
        return $this->ownedBy($user, $reservation)
            || $this->staffAllowed($user, P::ReservationsCancel, $reservation);
    }

    private function ownedBy(User $user, Reservation $reservation): bool
    {
        return $user->isCustomer() && $reservation->user_id === $user->getKey();
    }

    private function staffAllowed(User $user, P $permission, Reservation $reservation): bool
    {
        return $user->checkPermissionTo($permission->value)
            && $user->canAccessAgency($reservation->trip()->value('agency_id'));
    }
}
