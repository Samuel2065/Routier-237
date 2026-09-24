<?php

namespace App\Enums;

/**
 * Statut de publication d'un trajet (cahier des charges §7.4).
 *
 * Transitions autorisées :
 *   draft     → published, cancelled
 *   published → draft (sans réservation), cancelled, completed
 *   cancelled, completed : états finaux
 */
enum TripStatus: string
{
    case Draft = 'draft';
    case Published = 'published';
    case Cancelled = 'cancelled';
    case Completed = 'completed';

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
            self::Draft => [self::Published, self::Cancelled],
            self::Published => [self::Draft, self::Cancelled, self::Completed],
            self::Cancelled, self::Completed => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    /**
     * Un trajet annulé ou terminé n'est plus modifiable.
     */
    public function isEditable(): bool
    {
        return in_array($this, [self::Draft, self::Published], true);
    }
}
