<?php

namespace App\Policies;

use App\Enums\PermissionName as P;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\User;

class PaymentPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isCustomer() || $user->checkPermissionTo(P::PaymentsView->value);
    }

    public function view(User $user, Payment $payment): bool
    {
        $reservation = $payment->reservation;

        return $this->ownedBy($user, $reservation)
            || $this->staffAllowed($user, P::PaymentsView, $reservation);
    }

    /**
     * Le client initie le paiement de sa propre réservation.
     */
    public function create(User $user, Reservation $reservation): bool
    {
        return $this->ownedBy($user, $reservation);
    }

    public function refund(User $user, Payment $payment): bool
    {
        return $this->staffAllowed($user, P::PaymentsRefund, $payment->reservation);
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
