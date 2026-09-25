<?php

namespace Tests\Unit;

use App\Enums\ReservationStatus;
use App\Enums\TripStatus;
use PHPUnit\Framework\TestCase;

/**
 * Machines d'état des trajets (§7.4) et des réservations (§9.3), sans base de données.
 */
class StatusTransitionTest extends TestCase
{
    public function test_trip_transitions_follow_the_publication_workflow(): void
    {
        $allowed = [
            'draft' => ['published', 'cancelled'],
            'published' => ['draft', 'cancelled', 'completed'],
            'cancelled' => [],
            'completed' => [],
        ];

        foreach (TripStatus::cases() as $from) {
            foreach (TripStatus::cases() as $to) {
                $this->assertSame(
                    in_array($to->value, $allowed[$from->value], true),
                    $from->canTransitionTo($to),
                    "{$from->value} → {$to->value}",
                );
            }
        }
    }

    public function test_only_active_trips_are_editable(): void
    {
        $this->assertTrue(TripStatus::Draft->isEditable());
        $this->assertTrue(TripStatus::Published->isEditable());
        $this->assertFalse(TripStatus::Cancelled->isEditable());
        $this->assertFalse(TripStatus::Completed->isEditable());
    }

    public function test_reservation_transitions_are_explicit(): void
    {
        $allowed = [
            'pending' => ['confirmed', 'cancelled', 'expired'],
            'confirmed' => ['cancelled'],
            'cancelled' => [],
            'expired' => [],
        ];

        foreach (ReservationStatus::cases() as $from) {
            foreach (ReservationStatus::cases() as $to) {
                $this->assertSame(
                    in_array($to->value, $allowed[$from->value], true),
                    $from->canTransitionTo($to),
                    "{$from->value} → {$to->value}",
                );
            }
        }
    }

    public function test_a_status_never_transitions_to_itself(): void
    {
        foreach (TripStatus::cases() as $status) {
            $this->assertFalse($status->canTransitionTo($status));
        }
        foreach (ReservationStatus::cases() as $status) {
            $this->assertFalse($status->canTransitionTo($status));
        }
    }
}
