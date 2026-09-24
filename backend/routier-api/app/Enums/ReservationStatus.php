<?php

namespace App\Enums;

/**
 * Statut d'une réservation (cahier des charges §9.3), machine d'état contrôlée côté backend.
 *
 * Transitions autorisées :
 *   pending   → confirmed (paiement confirmé), cancelled, expired (délai dépassé)
 *   confirmed → cancelled
 *   cancelled, expired : états finaux
 */
enum ReservationStatus: string
{
    case Pending = 'pending';
    case Confirmed = 'confirmed';
    case Cancelled = 'cancelled';
    case Expired = 'expired';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * @return list<self>
     */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Pending => [self::Confirmed, self::Cancelled, self::Expired],
            self::Confirmed => [self::Cancelled],
            self::Cancelled, self::Expired => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }
}
